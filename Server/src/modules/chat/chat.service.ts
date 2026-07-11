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

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: ChatRealtimeService,
    private notification: NotificationService,
  ) {}

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

    // 尊重推送总开关：pushAllEnabled=false 的用户不发任何非交易类业务推送
    const pushable = await this.filterPushEnabled(offline);
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

  /**
   * 给卡片类消息发离线推送（供 FamilyEventService 调用）。
   * 排除发起人；尊重 pushAllEnabled；只推离线成员。
   */
  async notifyCardToOffline(groupId: string, title: string, excludeUserId: string | null) {
    const memberIds = await this.memberUserIds(groupId);
    const offline = memberIds.filter((id) => id !== excludeUserId && !this.realtime.isOnline(id));
    const pushable = await this.filterPushEnabled(offline);
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
      const msg = await tx.familyMessage.findUnique({ where: { id: messageId } });
      if (!msg || msg.groupId !== groupId) return null;
      const grp = await tx.familyGroup.update({
        where: { id: groupId },
        data: { lastSeq: { increment: 1 } },
        select: { lastSeq: true },
      });
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
    const target = BigInt(seq);
    const existing = await this.prisma.familyReadCursor.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    const current = existing?.lastReadSeq ?? BigInt(0);
    if (target <= current) {
      return { lastReadSeq: Number(current) };
    }
    await this.prisma.familyReadCursor.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId, lastReadSeq: target },
      update: { lastReadSeq: target },
    });
    // 广播已读，让他人界面实时更新"已读"
    const memberIds = await this.memberUserIds(groupId);
    this.realtime.signalUsers(
      memberIds.filter((id) => id !== userId),
      { op: 'read', groupId, userId, seq },
    );
    return { lastReadSeq: seq };
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
    const updated = await this.prisma.familyMessage.update({
      where: { id: messageId },
      data: { status: 'recalled', content: null, payload: Prisma.DbNull },
    });
    const memberIds = await this.memberUserIds(groupId);
    this.realtime.signalUsers(memberIds, { op: 'recall', groupId, messageId });
    return this.toView(updated);
  }

  /**
   * 我加入的每个群的未读数与已读游标（用于家庭 Tab 角标、切换 sheet）。
   */
  async unreadSummary(userId: string): Promise<
    Array<{ groupId: string; lastSeq: number; lastReadSeq: number; unread: number }>
  > {
    const members = await this.prisma.familyMember.findMany({
      where: { userId },
      select: { groupId: true, group: { select: { lastSeq: true } } },
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
      };
    });
  }
}
