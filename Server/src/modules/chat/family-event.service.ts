import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatService } from './chat.service';

export type CardType = 'help_request' | 'risk_alert' | 'case_share' | 'daily_scam' | 'milestone';

/**
 * V5.1 家庭事件流：卡片类内容的统一出入口。
 *
 * 一张卡片 = family_events 一条（结构化事实源，供统计/处置率）
 *          + family_messages 一条 type=card（进群渲染，payload 是卡片快照）。
 * emit 保证两者一致：先写事件 → 发卡片消息 → 回填 imMsgId。
 */
@Injectable()
export class FamilyEventService {
  constructor(
    private prisma: PrismaService,
    private chat: ChatService,
  ) {}

  /** 发一张卡片（写事件 + 发 card 消息） */
  async emit(input: {
    groupId: string;
    cardType: CardType;
    actorUserId?: string | null;
    riskLevel?: string | null;
    refType?: string | null;
    refId?: string | null;
    title: string;
    summary?: string | null;
    /** 附加卡片渲染数据（deepLink、称呼等） */
    extra?: Record<string, unknown>;
  }) {
    const event = await this.prisma.familyEvent.create({
      data: {
        groupId: input.groupId,
        actorUserId: input.actorUserId ?? null,
        cardType: input.cardType,
        riskLevel: input.riskLevel ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        status: 'open',
      },
    });

    const payload: Record<string, unknown> = {
      v: 1,
      cardType: input.cardType,
      eventId: event.id,
      title: input.title,
      summary: input.summary ?? '',
      riskLevel: input.riskLevel ?? 'none',
      actorUserId: input.actorUserId ?? null,
      ...(input.extra ?? {}),
    };

    const msg = await this.chat.postSystemMessage(input.groupId, 'card', {
      content: input.title,
      payload,
      eventId: event.id,
    });

    await this.prisma.familyEvent.update({
      where: { id: event.id },
      data: { imMsgId: msg.id, payload: payload as Prisma.InputJsonValue },
    });

    // 卡片离线推送：risk_alert 由旧 broadcast 路径推（双写期），其余卡片在此推离线成员
    if (input.cardType !== 'risk_alert') {
      await this.chat
        .notifyCardToOffline(input.groupId, input.title, input.actorUserId ?? null)
        .catch(() => undefined);
    }

    return { event, message: msg };
  }

  /**
   * chips 处置：更新事件状态 + 处置人。客户端同时发一条预设文本消息（走普通聊天）。
   * action ∈ dismissed(别信) | confirmed_safe(没事) | checking(我看看) | acknowledged(收到)
   */
  async handle(userId: string, eventId: string, action: string) {
    const valid = ['dismissed', 'confirmed_safe', 'checking', 'acknowledged'];
    if (!valid.includes(action)) throw new BadRequestException('invalid action');

    const event = await this.prisma.familyEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('event not found');
    await this.assertMember(userId, event.groupId);

    const updated = await this.prisma.familyEvent.update({
      where: { id: eventId },
      data: { status: action, handledBy: userId, handledAt: new Date() },
    });
    // 更新卡片消息 payload 的处置态，让所有端渲染横幅（改消息 → 客户端 update）
    if (event.imMsgId) {
      await this.updateCardStatus(event.groupId, event.imMsgId, action, userId);
    }
    return updated;
  }

  /** 老人求助：AI 结论快照由客户端带上（已在端上展示过） */
  async createHelpRequest(userId: string, input: {
    groupId: string;
    title: string;
    summary?: string;
    riskLevel?: string;
    refType?: string;
    refId?: string;
  }) {
    await this.assertMember(userId, input.groupId);
    return this.emit({
      groupId: input.groupId,
      cardType: 'help_request',
      actorUserId: userId,
      riskLevel: input.riskLevel,
      refType: input.refType ?? 'conversation',
      refId: input.refId,
      title: input.title,
      summary: input.summary,
    });
  }

  /** 案例/情报分享给家人 */
  async shareCase(userId: string, input: {
    groupId: string;
    refType: string;
    refId: string;
    title: string;
    summary?: string;
    riskLevel?: string;
  }) {
    await this.assertMember(userId, input.groupId);
    return this.emit({
      groupId: input.groupId,
      cardType: 'case_share',
      actorUserId: userId,
      riskLevel: input.riskLevel,
      refType: input.refType,
      refId: input.refId,
      title: input.title,
      summary: input.summary,
      extra: { sharerName: await this.resolveName(input.groupId, userId) },
    });
  }

  /**
   * V5.1 自动播报（T2-6）：某成员高风险查询 → 对其所有"允许分享"的家庭群发 risk_alert 卡片。
   * 由查询流程 fire-and-forget 调用；非高风险或未加入家庭时无操作。
   * 复用成员级 shareQueryResults 开关（线上已有），当日同内容去重靠 refId。
   */
  async autoBroadcastRiskAlert(userId: string, input: {
    title: string;
    summary?: string;
    riskLevel: string;
    refId?: string;
  }): Promise<number> {
    if (input.riskLevel !== 'high') return 0;
    const memberships = await this.prisma.familyMember.findMany({
      where: { userId, shareQueryResults: true },
      select: { groupId: true },
    });
    if (memberships.length === 0) return 0;

    const actorName = await this.resolveName(memberships[0].groupId, userId);
    let sent = 0;
    for (const m of memberships) {
      // 当日同 refId 去重：已发过就跳过
      if (input.refId) {
        const dup = await this.prisma.familyEvent.findFirst({
          where: {
            groupId: m.groupId, cardType: 'risk_alert', refId: input.refId,
            createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
          },
        });
        if (dup) continue;
      }
      await this.emit({
        groupId: m.groupId,
        cardType: 'risk_alert',
        actorUserId: userId,
        riskLevel: 'high',
        refType: 'query',
        refId: input.refId,
        title: actorName ? `${actorName}：${input.title}` : input.title,
        summary: input.summary,
      });
      sent++;
    }
    return sent;
  }

  /** 群内事件流（管理/调试用） */
  async listEvents(userId: string, groupId: string, limit = 50) {
    await this.assertMember(userId, groupId);
    return this.prisma.familyEvent.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  // MARK: - 内部

  private async updateCardStatus(groupId: string, msgId: string, action: string, handledBy: string) {
    // 通过 bumpAndSignalCard 重排 seq + 更新 payload + 广播信号，
    // 保证基于 seq 增量同步的客户端能重新拉到这条被处置的卡片（原地改 payload 不会被增量拉到）。
    await this.chat.bumpAndSignalCard(groupId, msgId, {
      handleStatus: action,
      handledBy,
      handledByName: await this.resolveName(groupId, handledBy),
    });
  }

  private async resolveName(groupId: string, userId: string): Promise<string | null> {
    const m = await this.prisma.familyMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { displayName: true, user: { select: { nickname: true } } },
    });
    return m?.displayName || m?.user?.nickname || null;
  }

  private async assertMember(userId: string, groupId: string) {
    const m = await this.prisma.familyMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!m) throw new ForbiddenException('not a member of this group');
    return m;
  }
}
