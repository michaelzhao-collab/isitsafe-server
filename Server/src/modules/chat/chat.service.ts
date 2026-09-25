import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FamilyMessage, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatRealtimeService } from './chat-realtime.service';
import { ChatMediaCleanupService } from './chat-media-cleanup.service';
import { NotificationService } from '../notification/notification.service';
import { SendMessageDto } from './dto/chat.dto';

/** 对外消息视图（BigInt → number，隐去内部字段） */
export interface MessageView {
  id: string;
  groupId: string;
  seq: number;
  senderId: string | null;
  type: string;
  content: string | null;
  payload: unknown;
  eventId: string | null;
  clientMsgId: string | null;
  status: string;
  version: number;
  createdAt: string;
}

const RECALL_WINDOW_MS = 2 * 60 * 1000; // 撤回窗口 2 分钟（与微信一致）
// 撤回墓碑补投递窗口：撤回不改 seq（墓碑需原地生效），错过 WS recall 信号的
// 离线端靠增量 pull 补投近期被撤回的消息（按 id upsert，seq 不变）
const RECALL_REDELIVERY_WINDOW_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: ChatRealtimeService,
    private notification: NotificationService,
    private mediaCleanup: ChatMediaCleanupService,
  ) {}

  /** 按 id 取单条消息视图（供事件去重时回传原卡片） */
  async messageView(id: string): Promise<MessageView | null> {
    const m = await this.prisma.familyMessage.findUnique({ where: { id } });
    return m ? this.toView(m) : null;
  }

  private toView(m: FamilyMessage): MessageView {
    return {
      id: m.id,
      groupId: m.groupId,
      seq: Number(m.seq),
      senderId: m.senderId,
      type: m.type,
      content: m.content,
      payload: m.payload ?? null,
      eventId: m.eventId,
      clientMsgId: m.clientMsgId,
      status: m.status,
      version: m.version,
      createdAt: m.createdAt.toISOString(),
    };
  }

  /** 校验并返回成员；非成员抛 403，组不存在抛 404 */
  async assertMember(userId: string, groupId: string) {
    const member = await this.prisma.familyMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      // 区分组不存在 vs 非成员
      const groupExists = await this.prisma.familyGroup.count({ where: { id: groupId } });
      if (!groupExists) throw new NotFoundException('家庭组不存在');
      throw new ForbiddenException('你不是该家庭成员');
    }
    return member;
  }

  /** 该组全部成员 userId（用于信号扇出 / 离线推送对象） */
  private async memberUserIds(groupId: string): Promise<string[]> {
    const rows = await this.prisma.familyMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  /**
   * 发送消息。事务内锁组行、lastSeq+1、写消息。
   * clientMsgId 幂等：已存在则直接返回原消息（不重复入库、不再扇出）。
   */
  async sendMessage(userId: string, groupId: string, dto: SendMessageDto): Promise<MessageView> {
    await this.assertMember(userId, groupId);

    // 先查幂等：同一 clientMsgId 已发过 → 直接返回，不浪费 seq
    const dup = await this.prisma.familyMessage.findUnique({
      where: { groupId_clientMsgId: { groupId, clientMsgId: dto.clientMsgId } },
    });
    if (dup) return this.toView(dup);

    let created: FamilyMessage;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        // increment 在事务内取组行锁，拿到自增后的 seq
        const grp = await tx.familyGroup.update({
          where: { id: groupId },
          data: { lastSeq: { increment: 1 } },
          select: { lastSeq: true },
        });
        const msg = await tx.familyMessage.create({
          data: {
            groupId,
            seq: grp.lastSeq,
            senderId: userId,
            type: dto.type,
            content: dto.content ?? null,
            payload: (dto.payload as Prisma.InputJsonValue) ?? Prisma.DbNull,
            clientMsgId: dto.clientMsgId,
          },
        });
        // 发送者对自己发的消息视为已读：同步推进其游标，否则未读数会把自己发的算进去
        await tx.familyReadCursor.upsert({
          where: { groupId_userId: { groupId, userId } },
          create: { groupId, userId, lastReadSeq: grp.lastSeq },
          update: { lastReadSeq: grp.lastSeq },
        });
        return msg;
      });
    } catch (err: any) {
      // 并发同 clientMsgId：另一请求已写入 → 回查返回（幂等）
      if (err?.code === 'P2002') {
        const winner = await this.prisma.familyMessage.findUnique({
          where: { groupId_clientMsgId: { groupId, clientMsgId: dto.clientMsgId } },
        });
        if (winner) return this.toView(winner);
      }
      throw err;
    }

    this.emitNew(groupId, created, userId).catch((e) =>
      this.logger.warn(`emitNew failed: ${String(e)}`),
    );
    return this.toView(created);
  }

  /**
   * 系统/官方消息入库（卡片、入群提示等）。senderId=null。
   * 供 family-event.service、群生命周期同步调用。
   */
  async postSystemMessage(
    groupId: string,
    type: 'card' | 'system',
    input: { content?: string | null; payload?: Record<string, unknown>; eventId?: string },
  ): Promise<MessageView> {
    const created = await this.prisma.$transaction(async (tx) => {
      const grp = await tx.familyGroup.update({
        where: { id: groupId },
        data: { lastSeq: { increment: 1 } },
        select: { lastSeq: true },
      });
      return tx.familyMessage.create({
        data: {
          groupId,
          seq: grp.lastSeq,
          senderId: null,
          type,
          content: input.content ?? null,
          payload: (input.payload as Prisma.InputJsonValue) ?? Prisma.DbNull,
          eventId: input.eventId ?? null,
        },
      });
    });
    this.emitNew(groupId, created, null).catch((e) =>
      this.logger.warn(`emitNew(system) failed: ${String(e)}`),
    );
    return this.toView(created);
  }

  /** 扇出"有新消息"信号（不含消息体）；对离线成员发 APNs 离线推送 */
  private async emitNew(groupId: string, msg: FamilyMessage, senderId: string | null) {
    const memberIds = await this.memberUserIds(groupId);
    const recipients = memberIds.filter((id) => id !== senderId);
    this.realtime.signalUsers(recipients, {
      op: 'new',
      groupId,
      seq: Number(msg.seq),
    });

    // 卡片类由 family-event 侧决定推送（求助/案例卡在那边推，风险播报走旧 broadcast），聊天消息在此发离线推送
    if (msg.type === 'card') return;
    const offline = recipients.filter((id) => !this.realtime.isOnline(id));
    if (offline.length === 0) return;

    // 尊重推送总开关（pushAllEnabled）+ 群聊免打扰（chatMuted）：都不发聊天横幅
    // 2026-09-07 复核修复：再过滤「接收人拉黑了发送者」——原来拉黑只在客户端隐藏气泡，
    // 推送照发，锁屏仍会弹出被拉黑者的消息，与"拉黑"语义相悖。
    const pushable = await this.filterBlockedBySender(
      senderId,
      await this.filterChatMuted(groupId, await this.filterPushEnabled(offline)),
    );
    if (pushable.length === 0) return;

    const group = await this.prisma.familyGroup.findUnique({
      where: { id: groupId },
      select: { name: true },
    });
    const senderName = await this.resolveSenderName(groupId, senderId);
    const groupName = group?.name || '家庭';
    const preview = this.previewText(msg);
    const collapseId = `chat_${groupId}`.slice(0, 64); // 同群合并，避免堆叠

    await this.notification.sendPushBatch(
      pushable.map((uid) => ({
        userId: uid,
        title: groupName,
        body: senderName ? `${senderName}：${preview}` : preview,
        category: 'family_chat',
        collapseId,
        customData: { type: 'family_chat', groupId },
      })),
    );
  }

  /** 过滤掉关闭了推送总开关（pushAllEnabled=false）的用户 */
  async filterPushEnabled(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.prisma.user.findMany({
      where: { id: { in: userIds }, pushAllEnabled: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** 过滤掉在该群开启了聊天免打扰（chatMuted=true）的成员 —— 只用于聊天/普通卡片推送 */
  async filterChatMuted(groupId: string, userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const muted = await this.prisma.familyMember.findMany({
      where: { groupId, userId: { in: userIds }, chatMuted: true },
      select: { userId: true },
    });
    if (muted.length === 0) return userIds;
    const mutedSet = new Set(muted.map((m) => m.userId));
    return userIds.filter((id) => !mutedSet.has(id));
  }

  /**
   * 过滤掉「已拉黑发送者」的接收人（2026-09-07 复核修复）。
   * senderId 为 null（系统卡片）时不过滤：官方卡片不受个人拉黑影响。
   */
  async filterBlockedBySender(senderId: string | null, userIds: string[]): Promise<string[]> {
    if (!senderId || userIds.length === 0) return userIds;
    const blocks = await this.prisma.imModeration.findMany({
      where: { type: 'block', targetId: senderId, reporterId: { in: userIds } },
      select: { reporterId: true },
    });
    if (blocks.length === 0) return userIds;
    const blockedSet = new Set(blocks.map((b) => b.reporterId));
    return userIds.filter((id) => !blockedSet.has(id));
  }

  /**
   * 给卡片类消息发离线推送（供 FamilyEventService 调用）。
   * 排除发起人；尊重 pushAllEnabled；只推离线成员。
   *
   * 2026-09-07 复核修复：新增 bypassMute。需求文档明确"高风险强提醒不受免打扰影响"，
   * 但原实现对所有卡片无条件过滤 chatMuted，导致子女开了群免打扰后，
   * 老人发出的高风险求助卡完全收不到推送——这是产品的核心闭环。
   * 注意：bypassMute 只跳过群内免打扰，仍然尊重系统级推送总开关 pushAllEnabled。
   */
  async notifyCardToOffline(
    groupId: string,
    title: string,
    excludeUserId: string | null,
    opts: { bypassMute?: boolean } = {},
  ) {
    const memberIds = await this.memberUserIds(groupId);
    const offline = memberIds.filter((id) => id !== excludeUserId && !this.realtime.isOnline(id));
    const pushEnabled = await this.filterPushEnabled(offline);
    const pushable = opts.bypassMute
      ? pushEnabled
      : await this.filterChatMuted(groupId, pushEnabled);
    if (pushable.length === 0) return;
    const group = await this.prisma.familyGroup.findUnique({
      where: { id: groupId }, select: { name: true },
    });
    await this.notification.sendPushBatch(
      pushable.map((uid) => ({
        userId: uid,
        title: group?.name || '家庭',
        body: title.slice(0, 40),
        category: 'family_chat',
        collapseId: `chat_${groupId}`.slice(0, 64),
        customData: { type: 'family_card', groupId },
      })),
    );
  }

  /**
   * 卡片状态变更传播：把卡片消息重排到新的 seq（+ 更新 payload/version），
   * 使基于 seq 增量同步的客户端能重新拉到这条被就地编辑的卡片。
   * 否则 seq > afterSeq 的增量拉取永远看不到旧消息的原地修改。
   */
  async bumpAndSignalCard(groupId: string, messageId: string, payloadPatch: Record<string, unknown>) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const exists = await tx.familyMessage.findUnique({
        where: { id: messageId },
        select: { groupId: true },
      });
      if (!exists || exists.groupId !== groupId) return null;
      // 先拿组行锁再读 payload：并发处置同一张卡时串行化，后到方能读到先到方的补丁，合并不丢
      const grp = await tx.familyGroup.update({
        where: { id: groupId },
        data: { lastSeq: { increment: 1 } },
        select: { lastSeq: true },
      });
      const msg = await tx.familyMessage.findUnique({ where: { id: messageId } });
      if (!msg) return null;
      const payload = { ...((msg.payload as Record<string, unknown>) ?? {}), ...payloadPatch };
      return tx.familyMessage.update({
        where: { id: messageId },
        data: { seq: grp.lastSeq, payload: payload as Prisma.InputJsonValue, version: { increment: 1 } },
      });
    });
    if (!updated) return;
    const memberIds = await this.memberUserIds(groupId);
    this.realtime.signalUsers(memberIds, { op: 'new', groupId, seq: Number(updated.seq) });
  }

  private async resolveSenderName(groupId: string, senderId: string | null): Promise<string | null> {
    if (!senderId) return null;
    const member = await this.prisma.familyMember.findUnique({
      where: { groupId_userId: { groupId, userId: senderId } },
      select: { displayName: true, user: { select: { nickname: true } } },
    });
    return member?.displayName || member?.user?.nickname || null;
  }

  private previewText(msg: FamilyMessage): string {
    switch (msg.type) {
      case 'text':
      case 'bigEmoji':
        return (msg.content || '').slice(0, 30) || '[消息]';
      case 'voice':
        return '[语音]';
      case 'image':
        return '[图片]';
      default:
        return '[消息]';
    }
  }

  /**
   * 增量拉取（afterSeq，升序）或历史回溯（beforeSeq，降序返回后端已翻正为升序）。
   * 二者都不传 → 返回最近 limit 条（升序）。
   */
  async pull(
    userId: string,
    groupId: string,
    opts: { afterSeq?: number; beforeSeq?: number; limit?: number },
  ): Promise<{ messages: MessageView[]; lastSeq: number }> {
    await this.assertMember(userId, groupId);
    const limit = Math.min(opts.limit ?? 50, 100);

    let rows: FamilyMessage[];
    if (opts.afterSeq != null) {
      rows = await this.prisma.familyMessage.findMany({
        where: { groupId, seq: { gt: BigInt(opts.afterSeq) } },
        orderBy: { seq: 'asc' },
        take: limit,
      });
      // 撤回补投递：撤回不改 seq，仅靠 WS 信号会被离线端永久错过。
      // 增量 pull 额外附带窗口期内 seq<=afterSeq 的撤回墓碑（与上面结果天然不重叠），
      // 客户端按 id upsert、seq 不变 → 墓碑原地生效。撤回极少发生，通常为空集。
      const recalledTombstones = await this.prisma.familyMessage.findMany({
        where: {
          groupId,
          status: 'recalled',
          seq: { lte: BigInt(opts.afterSeq) },
          createdAt: { gte: new Date(Date.now() - RECALL_REDELIVERY_WINDOW_MS) },
        },
        orderBy: { seq: 'desc' },
        // 上限须低于客户端分页阈值 50：若墓碑集独自凑满一页，客户端“count<50 即追平”
        // 的判断会误判未追平、以不变的 afterSeq 重复拉取（死循环）
        take: 20,
      });
      if (recalledTombstones.length > 0) {
        rows = [...recalledTombstones.reverse(), ...rows];
      }
    } else if (opts.beforeSeq != null) {
      const desc = await this.prisma.familyMessage.findMany({
        where: { groupId, seq: { lt: BigInt(opts.beforeSeq) } },
        orderBy: { seq: 'desc' },
        take: limit,
      });
      rows = desc.reverse();
    } else {
      const desc = await this.prisma.familyMessage.findMany({
        where: { groupId },
        orderBy: { seq: 'desc' },
        take: limit,
      });
      rows = desc.reverse();
    }

    const grp = await this.prisma.familyGroup.findUnique({
      where: { id: groupId },
      select: { lastSeq: true },
    });
    return {
      messages: rows.map((m) => this.toView(m)),
      lastSeq: Number(grp?.lastSeq ?? 0),
    };
  }

  /**
   * 推进已读游标（只增不减）。返回是否实际推进 + 供 UI 的已读广播。
   */
  async updateReadCursor(userId: string, groupId: string, seq: number): Promise<{ lastReadSeq: number }> {
    await this.assertMember(userId, groupId);
    // clamp 到组内高水位：防止把游标推到未发出的消息之后（对未来消息伪造"已读"）
    const grp = await this.prisma.familyGroup.findUnique({
      where: { id: groupId },
      select: { lastSeq: true },
    });
    const target = BigInt(seq) < (grp?.lastSeq ?? BigInt(0)) ? BigInt(seq) : (grp?.lastSeq ?? BigInt(0));
    if (target <= BigInt(0)) return { lastReadSeq: 0 };

    // 原子条件推进（只增不减）：并发多次上报时旧值无法覆盖新值
    const advanced = await this.prisma.familyReadCursor.updateMany({
      where: { groupId, userId, lastReadSeq: { lt: target } },
      data: { lastReadSeq: target },
    });
    if (advanced.count === 0) {
      const existing = await this.prisma.familyReadCursor.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (existing) {
        // 已有更靠前的游标 → 本次是迟到的旧上报，不广播
        return { lastReadSeq: Number(existing.lastReadSeq) };
      }
      try {
        await this.prisma.familyReadCursor.create({
          data: { groupId, userId, lastReadSeq: target },
        });
      } catch (err: any) {
        // 并发首建撞唯一键 → 对方已建行，条件推进一次即可
        if (err?.code !== 'P2002') throw err;
        await this.prisma.familyReadCursor.updateMany({
          where: { groupId, userId, lastReadSeq: { lt: target } },
          data: { lastReadSeq: target },
        });
      }
    }
    // 广播已读，让他人界面实时更新"已读"
    const memberIds = await this.memberUserIds(groupId);
    this.realtime.signalUsers(
      memberIds.filter((id) => id !== userId),
      { op: 'read', groupId, userId, seq: Number(target) },
    );
    return { lastReadSeq: Number(target) };
  }

  /**
   * 撤回：仅本人、2 分钟内、normal 消息。置 recalled 墓碑。
   */
  async recall(userId: string, groupId: string, messageId: string): Promise<MessageView> {
    await this.assertMember(userId, groupId);
    const msg = await this.prisma.familyMessage.findUnique({ where: { id: messageId } });
    if (!msg || msg.groupId !== groupId) throw new NotFoundException('消息不存在');
    if (msg.senderId !== userId) throw new ForbiddenException('只能撤回自己的消息');
    if (msg.status === 'recalled') return this.toView(msg);
    if (Date.now() - msg.createdAt.getTime() > RECALL_WINDOW_MS) {
      throw new BadRequestException('超过 2 分钟，无法撤回');
    }
    // 2026-09-07 复核修复：先留存 payload，置空后再异步删 R2 对象。
    // 原来只清 payload，语音/图片文件仍公开可访问，撤回形同虚设。
    const mediaPayload = msg.type === 'voice' || msg.type === 'image' ? msg.payload : null;
    const updated = await this.prisma.familyMessage.update({
      where: { id: messageId },
      data: { status: 'recalled', content: null, payload: Prisma.DbNull },
    });
    if (mediaPayload) {
      // fire-and-forget：对象存储删除失败不能影响撤回结果
      void this.mediaCleanup
        .deleteMessageMedia(mediaPayload)
        .catch((e) => this.logger.warn(`recall media cleanup failed: ${String(e)}`));
    }
    const memberIds = await this.memberUserIds(groupId);
    this.realtime.signalUsers(memberIds, { op: 'recall', groupId, messageId });
    return this.toView(updated);
  }

  /**
   * 我加入的每个群的未读数与已读游标（用于家庭 Tab 角标、切换 sheet）。
   * muted：我在该群是否开启了聊天免打扰（客户端据此把未读数字渲染为小红点）。
   */
  async unreadSummary(userId: string): Promise<
    Array<{ groupId: string; lastSeq: number; lastReadSeq: number; unread: number; muted: boolean }>
  > {
    const members = await this.prisma.familyMember.findMany({
      where: { userId },
      select: { groupId: true, chatMuted: true, group: { select: { lastSeq: true } } },
    });
    if (members.length === 0) return [];
    const cursors = await this.prisma.familyReadCursor.findMany({
      where: { userId, groupId: { in: members.map((m) => m.groupId) } },
    });
    const cursorMap = new Map(cursors.map((c) => [c.groupId, c.lastReadSeq]));
    return members.map((m) => {
      const lastSeq = Number(m.group.lastSeq);
      const lastReadSeq = Number(cursorMap.get(m.groupId) ?? BigInt(0));
      return {
        groupId: m.groupId,
        lastSeq,
        lastReadSeq,
        unread: Math.max(0, lastSeq - lastReadSeq),
        muted: m.chatMuted,
      };
    });
  }

  /**
   * V5.1 §7-4 已读名单："女儿已读"。返回该群每个成员的已读游标，
   * 客户端对自己发的消息计算 lastReadSeq >= msg.seq 的成员集渲染已读名单。
   */
  async readStates(
    userId: string,
    groupId: string,
  ): Promise<Array<{ userId: string; lastReadSeq: number }>> {
    await this.assertMember(userId, groupId);
    // 只返回现任成员的游标：退群成员的游标行不随成员删除清理，不过滤会把前成员算进已读名单
    const memberIds = await this.memberUserIds(groupId);
    const cursors = await this.prisma.familyReadCursor.findMany({
      where: { groupId, userId: { in: memberIds } },
      select: { userId: true, lastReadSeq: true },
    });
    return cursors.map((c) => ({ userId: c.userId, lastReadSeq: Number(c.lastReadSeq) }));
  }
}
