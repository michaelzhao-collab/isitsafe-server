import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SubscriptionService } from '../subscription/subscription.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('admin/subscription')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminSubscriptionController {
  constructor(private sub: SubscriptionService, private prisma: PrismaService) {}

  @Get('logs')
  async logs() {
    return this.sub.getLogs();
  }

  /** 会员订单列表：分页 + 可选 status / userKeyword 模糊（phone/email/nickname） */
  @Get('orders')
  async orders(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
    @Query('userKeyword') userKeyword?: string,
  ) {
    return this.sub.listOrders(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      status,
      userKeyword,
    );
  }

  /**
   * 诊断：返回 subscriptions 表分布 + users.subscriptionStatus 分布
   * 用于排查"用户付费成功但管理后台订单为空"
   */
  @Get('diagnostics')
  async diagnostics() {
    const [totalSubs, statusCounts, premiumUsers, latestSub, recentVerifiedUsers] = await Promise.all([
      this.prisma.subscription.count(),
      this.prisma.subscription.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.user.count({ where: { subscriptionStatus: 'premium' } }),
      this.prisma.subscription.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, userId: true, productId: true, status: true, createdAt: true, paymentMethod: true },
      }),
      this.prisma.user.findMany({
        where: { subscriptionStatus: 'premium' },
        orderBy: { subscriptionExpire: 'desc' },
        take: 10,
        select: {
          id: true,
          phone: true,
          email: true,
          subscriptionStatus: true,
          subscriptionExpire: true,
          subscriptions: { take: 3, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, productId: true, createdAt: true, paymentMethod: true, transactionId: true } },
        },
      }),
    ]);
    // 关键诊断：subscriptionStatus=premium 但 subscriptions[] 为空的用户（验证逻辑断裂的强信号）
    const orphanPremium = recentVerifiedUsers.filter((u) => u.subscriptions.length === 0);
    return {
      totalSubscriptions: totalSubs,
      subscriptionsByStatus: statusCounts.map((c) => ({ status: c.status, count: c._count._all })),
      usersPremiumCount: premiumUsers,
      latestSubscription: latestSub,
      orphanPremiumUsers: orphanPremium.map((u) => ({ id: u.id, phone: u.phone, email: u.email, subscriptionExpire: u.subscriptionExpire })),
      hint: orphanPremium.length > 0
        ? '⚠️ 有 premium 用户但 subscriptions 表无记录 — verify 接口可能没被调用过，或 webhook 配置错误'
        : '✓ premium 用户都有 subscriptions 记录',
    };
  }
}
