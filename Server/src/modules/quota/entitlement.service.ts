import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 单一权益类型 (V3-S1)
 *
 *   free            — 未付费用户
 *   personal_pro    — 个人 Pro 订阅生效
 *   family_owner    — 家庭套餐 owner（自己付费，全家共享）
 *   family_member   — 家庭套餐成员（owner 付费，自动共享）
 *
 * 业务含义：除 free 外均"查询不限/天 + 官方提醒不限"。
 */
export type EntitlementTier =
  | 'free'
  | 'personal_pro'
  | 'family_owner'
  | 'family_member';

export interface Entitlement {
  tier: EntitlementTier;
  isUnlimited: boolean;
  /** 来源解释，方便排障 */
  source: string;
}

@Injectable()
export class EntitlementService {
  constructor(private prisma: PrismaService) {}

  /**
   * 计算用户当前权益。
   *
   * 判定顺序：
   *   ① 自己有 active personal-tier 订阅 → personal_pro
   *   ② 自己有 active family-tier 订阅 → family_owner（同时是 family group owner 时尤其有意义）
   *   ③ 自己在家庭组里，且 owner 有 active family-tier 订阅 → family_member
   *   ④ 其余 → free
   *
   * 这里有个细节：若用户「同时」买了个人 Pro 又是 family_member，
   * 我们返回 personal_pro（个人订阅优先，体现"用户也为自己付了钱"）。
   * 对外行为完全等价（都 isUnlimited=true），仅追踪 source 时区分。
   */
  async getUserEntitlement(userId: string): Promise<Entitlement> {
    // 1) 自己的 active 订阅 → join MembershipPlan 拿 tier
    const ownSub = await this.findActiveSubscriptionWithTier(userId);
    if (ownSub?.tier === 'personal') {
      return {
        tier: 'personal_pro',
        isUnlimited: true,
        source: `own_sub:${ownSub.productId}`,
      };
    }
    if (ownSub?.tier === 'family') {
      return {
        tier: 'family_owner',
        isUnlimited: true,
        source: `own_family_sub:${ownSub.productId}`,
      };
    }

    // 2) 自己不付费，但在家庭组里 → 看 owner
    const member = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: { group: { select: { ownerUserId: true } } },
    });
    if (member && member.group.ownerUserId !== userId) {
      const ownerSub = await this.findActiveSubscriptionWithTier(
        member.group.ownerUserId,
      );
      if (ownerSub?.tier === 'family') {
        return {
          tier: 'family_member',
          isUnlimited: true,
          source: `family_owner_sub:${ownerSub.productId}`,
        };
      }
    }

    // 3) 兜底：免费
    return {
      tier: 'free',
      isUnlimited: false,
      source: 'no_active_subscription',
    };
  }

  /**
   * 找用户当前 active 的最新订阅，并 join MembershipPlan 取 tier。
   * 兼容老数据：MembershipPlan 不存在时按 productId 命名约定（family.*）兜底判定。
   */
  private async findActiveSubscriptionWithTier(userId: string): Promise<{
    productId: string;
    tier: 'personal' | 'family';
  } | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        expireTime: { gt: new Date() },
      },
      orderBy: { expireTime: 'desc' },
      select: { productId: true },
    });
    if (!sub) return null;

    const plan = await this.prisma.membershipPlan.findFirst({
      where: { productId: sub.productId },
      select: { tier: true },
    });
    if (plan) {
      return {
        productId: sub.productId,
        tier: plan.tier === 'family' ? 'family' : 'personal',
      };
    }
    // 兜底：MembershipPlan 未录入时，按 productId 命名约定判定
    const looksLikeFamily =
      sub.productId.includes('.family.') || sub.productId.startsWith('family.');
    return {
      productId: sub.productId,
      tier: looksLikeFamily ? 'family' : 'personal',
    };
  }
}
