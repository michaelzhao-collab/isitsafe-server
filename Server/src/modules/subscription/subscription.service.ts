import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function planTypeFromProductId(productId: string): 'weekly' | 'monthly' | 'yearly' {
  const id = (productId || '').toLowerCase();
  if (id.includes('week')) return 'weekly';
  if (id.includes('year')) return 'yearly';
  return 'monthly';
}

function computeExpireTime(productId: string): Date {
  const now = new Date();
  const plan = planTypeFromProductId(productId);
  const exp = new Date(now);
  if (plan === 'weekly') exp.setDate(exp.getDate() + 7);
  else if (plan === 'yearly') exp.setFullYear(exp.getFullYear() + 1);
  else exp.setMonth(exp.getMonth() + 1);
  return exp;
}

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async verify(
    userId: string,
    productId: string,
    receipt: string,
    paymentMethod: 'Apple' | 'Google',
    transactionId?: string,
  ) {
    // 实际项目需调用 Apple/Google 服务器验证收据
    const expireTime = computeExpireTime(productId);
    const planType = planTypeFromProductId(productId);

    const historyLog = [{ at: new Date().toISOString(), action: 'verify', productId, receipt: receipt.slice(0, 20) }];

    let sub = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (sub) {
      sub = await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          productId,
          planType,
          status: 'active',
          expireTime,
          transactionId: transactionId ?? undefined,
          historyLog: historyLog as any,
          paymentMethod,
        },
      });
    } else {
      sub = await this.prisma.subscription.create({
        data: {
          userId,
          productId,
          planType,
          status: 'active',
          expireTime,
          transactionId: transactionId ?? undefined,
          historyLog: historyLog as any,
          paymentMethod,
        },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'premium', subscriptionExpire: expireTime },
    });

    return { success: true, subscription: sub };
  }

  async getStatus(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { expireTime: 'desc' },
    });
    if (!sub)
      return {
        active: false,
        expireTime: null,
        productId: null,
        status: null,
        isPremium: false,
        planType: null,
      };
    const active = sub.status === 'active' && sub.expireTime > new Date();
    const isPremium = active;
    return {
      active,
      expireTime: sub.expireTime,
      productId: sub.productId,
      status: sub.status,
      isPremium,
      planType: sub.planType,
    };
  }

  async refresh(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { expireTime: 'desc' },
    });
    if (!sub) return { active: false, expireTime: null, productId: null, status: null };
    const active = sub.status === 'active' && sub.expireTime > new Date();
    if (!active && sub.status === 'active') {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'expired' },
      });
    }
    return this.getStatus(userId);
  }

  async getLogs(limit = 100) {
    return this.prisma.subscription.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, phone: true, email: true, country: true } } },
    });
  }
}
