import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('admin/ai')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminAnalyticsController {
  constructor(private prisma: PrismaService) {}

  @Get('stats')
  async stats(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const [totalQueries, highRiskCount, aiLogsTotal, byProvider] = await Promise.all([
      this.prisma.query.count({ where }),
      this.prisma.query.count({ where: { ...where, riskLevel: 'high' } }),
      this.prisma.aiLog.count({ where }),
      this.prisma.aiLog.groupBy({ by: ['provider'], where, _count: true }),
    ]);
    return {
      totalQueries,
      highRiskCount,
      aiLogsTotal,
      byProvider,
    };
  }

  @Get('logs')
  async logs(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const [items, total] = await Promise.all([
      this.prisma.aiLog.findMany({
        where,
        skip,
        take: parseInt(pageSize, 10),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aiLog.count({ where }),
    ]);
    return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
  }
}
