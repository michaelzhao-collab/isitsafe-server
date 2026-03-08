import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 每小时将已过期的用户 subscriptionStatus 置为 free
 */
@Injectable()
export class MembershipCronService {
  constructor(private prisma: PrismaService) {}

  @Cron('0 * * * *')
  async expireSubscriptionStatus() {
    const now = new Date();
    const result = await this.prisma.user.updateMany({
      where: {
        subscriptionStatus: 'premium',
        subscriptionExpire: { lt: now },
      },
      data: { subscriptionStatus: 'free' },
    });
    if (result.count > 0) {
      // 可选：写日志
    }
  }
}
