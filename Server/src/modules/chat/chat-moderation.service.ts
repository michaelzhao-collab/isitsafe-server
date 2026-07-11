import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  /** 拉黑某成员（仅本地记录；渲染层据此隐藏其消息） */
  async block(reporterId: string, targetUserId: string) {
    if (reporterId === targetUserId) throw new ForbiddenException('Cannot block yourself');
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
    return rows.map((r) => r.targetId).filter((x): x is string => !!x);
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
}
