import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';

/**
 * 会员状态判断：subscriptionExpire > now 则为 premium
 */
export function isPremium(user: Pick<User, 'subscriptionExpire'> | null): boolean {
  if (!user?.subscriptionExpire) return false;
  return new Date(user.subscriptionExpire) > new Date();
}

@Injectable()
export class MembershipService {
  constructor(private prisma: PrismaService) {}

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
   * 根据 userId 判断是否会员（用于限流等）
   */
  async isPremiumByUserId(userId: string | null): Promise<boolean> {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionExpire: true },
    });
    return isPremium(user);
  }
}
