import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
import { EntitlementService } from '../quota/entitlement.service';

/**
 * 会员状态判断：subscriptionExpire > now 则为 premium
 */
export function isPremium(user: Pick<User, 'subscriptionExpire'> | null): boolean {
  if (!user?.subscriptionExpire) return false;
  return new Date(user.subscriptionExpire) > new Date();
}

@Injectable()
export class MembershipService {
  constructor(
    private prisma: PrismaService,
    private entitlement: EntitlementService,
  ) {}

  /**
   * 公开接口：返回当前可用的会员套餐（isActive=true，按 sortOrder 排序）
   */
  async getActivePlans() {
    return this.prisma.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        name: true,
        productId: true,
        price: true,
        currency: true,
        period: true,
        introPrice: true,
        introPeriod: true,
        firstPurchaseOnly: true,
        isRecommended: true,
      },
    });
  }

  /**
   * 根据 userId 判断是否会员（用于限流等）。
   *
   * 2026-10-20 复核修复：原来只看 users.subscriptionExpire，家庭套餐成员（owner 付费）在
   * /ai/analyze 上仍被当免费用户限 5 次/天；/query 走的是 EntitlementService 不限次，两套口径不一致。
   * 统一走 EntitlementService（个人 Pro / 家庭 owner / 家庭成员 均 isUnlimited）。
   * 查询失败时退回原来的 subscriptionExpire 判定，不因一次 DB 抖动把会员当免费。
   */
  async isPremiumByUserId(userId: string | null): Promise<boolean> {
    if (!userId) return false;
    try {
      const ent = await this.entitlement.getUserEntitlement(userId);
      if (ent.isUnlimited) return true;
    } catch {
      /* fall through */
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionExpire: true },
    });
    return isPremium(user);
  }
}
