import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * V5.1 自建 IM 举报 / 拉黑（App Store 1.2 合规最小集）。
 * 举报落库供 admin 审阅；拉黑记录成对（block/unblock）。不做内容自动删除。
 */
@Injectable()
export class ChatModerationService {
  constructor(private prisma: PrismaService) {}

  /** 举报一条消息 */
  async report(reporterId: string, input: { groupId: string; messageId: string; reason?: string }) {
    // 必须是该群成员才能举报
    const member = await this.prisma.familyMember.findUnique({
      where: { groupId_userId: { groupId: input.groupId, userId: reporterId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this group');
    const msg = await this.prisma.familyMessage.findUnique({ where: { id: input.messageId } });
    if (!msg || msg.groupId !== input.groupId) throw new NotFoundException('Message not found');

    // 2026-09-07 复核修复：同一人对同一条消息重复举报（误触/网络重试）会堆出多行，
    // 后台待处理队列被同一件事刷屏。已有未处置记录时直接幂等返回。
    const existingReport = await this.prisma.imModeration.findFirst({
      where: {
        type: 'report',
        reporterId,
        imMsgId: input.messageId,
        status: 'pending',
      },
      select: { id: true },
    });
    if (existingReport) return { success: true };

    await this.prisma.imModeration.create({
      data: {
        type: 'report',
        reporterId,
        groupId: input.groupId,
        imMsgId: input.messageId,
        reason: input.reason?.slice(0, 500) ?? null,
      },
    });
    return { success: true };
  }

  /** 拉黑某成员（仅本地记录；渲染层与推送据此过滤其消息） */
  async block(reporterId: string, targetUserId: string) {
    if (reporterId === targetUserId) throw new ForbiddenException('Cannot block yourself');
    // 2026-09-07 复核修复：原来无条件 create，重复调用产生多行，
    // blockedUserIds 会返回重复 id，admin 列表也出现同一对关系的多条记录。
    const existing = await this.prisma.imModeration.findFirst({
      where: { type: 'block', reporterId, targetId: targetUserId },
      select: { id: true },
    });
    if (existing) return { success: true };

    // 校验目标用户存在，避免脏 id 进库（admin 列表会显示成空昵称）
    const target = await this.prisma.user.count({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.imModeration.create({
      data: { type: 'block', reporterId, targetId: targetUserId },
    });
    return { success: true };
  }

  /** 解除拉黑：删除该 reporter→target 的 block 记录 */
  async unblock(reporterId: string, targetUserId: string) {
    await this.prisma.imModeration.deleteMany({
      where: { type: 'block', reporterId, targetId: targetUserId },
    });
    return { success: true };
  }

  /** 我拉黑的人（客户端渲染时过滤） */
  async blockedUserIds(reporterId: string): Promise<string[]> {
    const rows = await this.prisma.imModeration.findMany({
      where: { type: 'block', reporterId },
      select: { targetId: true },
    });
    // 去重：历史数据里可能已有重复行（block 加去重之前产生的）
    return Array.from(new Set(rows.map((r) => r.targetId).filter((x): x is string => !!x)));
  }

  /** 管理后台：举报列表 */
  async listReports(page = 1, pageSize = 30) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.imModeration.findMany({
        where: { type: 'report' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.imModeration.count({ where: { type: 'report' } }),
    ]);
    return { items, total, page, pageSize };
  }

  // ====== 管理后台（App Store 1.2 合规：查看 + 处置举报/拉黑）======

  /**
   * admin 列表（举报/拉黑），带被举报消息快照 + 举报人/被处置人昵称 + 群名，供后台审阅。
   */
  async adminList(params: { type?: string; status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(params.pageSize ?? 30, 100);
    const where: { type?: string; status?: string } = {};
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;

    const [rows, total] = await Promise.all([
      this.prisma.imModeration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.imModeration.count({ where }),
    ]);

    // 批量取关联实体：消息、用户、群
    const msgIds = rows.map((r) => r.imMsgId).filter((x): x is string => !!x);
    const userIds = Array.from(
      new Set(rows.flatMap((r) => [r.reporterId, r.targetId].filter((x): x is string => !!x))),
    );
    const groupIds = Array.from(new Set(rows.map((r) => r.groupId).filter((x): x is string => !!x)));

    const [messages, users, groups] = await Promise.all([
      msgIds.length
        ? this.prisma.familyMessage.findMany({
            where: { id: { in: msgIds } },
            select: { id: true, type: true, content: true, senderId: true, status: true },
          })
        : Promise.resolve([]),
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, nickname: true },
          })
        : Promise.resolve([]),
      groupIds.length
        ? this.prisma.familyGroup.findMany({
            where: { id: { in: groupIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const msgMap = new Map(messages.map((m) => [m.id, m]));
    const userMap = new Map(users.map((u) => [u.id, u.nickname]));
    const groupMap = new Map(groups.map((g) => [g.id, g.name]));

    const items = rows.map((r) => {
      const msg = r.imMsgId ? msgMap.get(r.imMsgId) : null;
      return {
        id: r.id,
        type: r.type,
        status: r.status,
        reason: r.reason,
        reporterId: r.reporterId,
        reporterName: userMap.get(r.reporterId) ?? null,
        targetId: r.targetId,
        targetName: r.targetId ? (userMap.get(r.targetId) ?? null) : null,
        groupId: r.groupId,
        groupName: r.groupId ? (groupMap.get(r.groupId) ?? null) : null,
        messageId: r.imMsgId,
        messageType: msg?.type ?? null,
        // 举报消息内容快照；已撤回则不回显正文
        messageContent: msg && msg.status !== 'recalled' ? msg.content : null,
        messageRecalled: msg?.status === 'recalled',
        createdAt: r.createdAt,
      };
    });
    return { items, total, page, pageSize };
  }

  /** admin 处置：更新举报/拉黑记录状态 pending → reviewed | actioned */
  async adminUpdateStatus(id: string, status: string) {
    const valid = ['pending', 'reviewed', 'actioned'];
    if (!valid.includes(status)) throw new BadRequestException('invalid status');
    const row = await this.prisma.imModeration.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('moderation not found');
    return this.prisma.imModeration.update({ where: { id }, data: { status } });
  }

  /** admin 统计小卡：待处理 / 已处理 / 总数 */
  async adminStats() {
    const [pending, reviewed, actioned, total] = await Promise.all([
      this.prisma.imModeration.count({ where: { type: 'report', status: 'pending' } }),
      this.prisma.imModeration.count({ where: { type: 'report', status: 'reviewed' } }),
      this.prisma.imModeration.count({ where: { type: 'report', status: 'actioned' } }),
      this.prisma.imModeration.count({ where: { type: 'report' } }),
    ]);
    return { pending, reviewed, actioned, total };
  }
}
