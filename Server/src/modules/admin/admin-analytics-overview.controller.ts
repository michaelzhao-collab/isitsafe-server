import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

/** 按 Asia/Shanghai 自然日 [start, end) */
function getShanghaiDayRange(reference = new Date()): { start: Date; end: Date } {
  const d = reference.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const start = new Date(`${d}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminAnalyticsOverviewController {
  constructor(private prisma: PrismaService) {}

  @Get('overview')
  async overview() {
    const baseWhere: { deletedAt: null } = { deletedAt: null };
    const { start: dayStart, end: dayEnd } = getShanghaiDayRange();
    const todayWhere = { ...baseWhere, createdAt: { gte: dayStart, lt: dayEnd } };
    const highWhere = { ...baseWhere, riskLevel: 'high' };
    const todayHighWhere = { ...todayWhere, riskLevel: 'high' };

    const [totalQueries, todayQueries, totalHighRiskCount, todayHighRiskCount, totalUsers, riskGroups] =
      await Promise.all([
        this.prisma.query.count({ where: baseWhere }),
        this.prisma.query.count({ where: todayWhere }),
        this.prisma.query.count({ where: highWhere }),
        this.prisma.query.count({ where: todayHighWhere }),
        this.prisma.user.count(),
        this.prisma.query.groupBy({
          by: ['riskLevel'],
          where: baseWhere,
          _count: true,
        }),
      ]);

    const riskDistribution: Record<string, number> = { high: 0, medium: 0, low: 0, unknown: 0 };
    for (const g of riskGroups) {
      const key = (g.riskLevel ?? 'unknown').toLowerCase();
      if (key === 'high' || key === 'medium' || key === 'low') {
        riskDistribution[key] += g._count;
      } else {
        riskDistribution.unknown += g._count;
      }
    }

    return {
      totalQueries,
      todayQueries,
      totalHighRiskCount,
      todayHighRiskCount,
      totalUsers,
      riskDistribution,
    };
  }
}
