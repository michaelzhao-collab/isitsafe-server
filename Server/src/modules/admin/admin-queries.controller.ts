import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('admin/queries')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminQueriesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('riskLevel') riskLevel?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const where: any = {};
    if (includeDeleted !== '1') where.deletedAt = null;
    if (riskLevel) where.riskLevel = riskLevel;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const [items, total] = await Promise.all([
      this.prisma.query.findMany({
        where,
        skip,
        take: parseInt(pageSize, 10),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, phone: true, email: true } } },
      }),
      this.prisma.query.count({ where }),
    ]);
    return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.prisma.query.findUniqueOrThrow({
      where: { id },
      include: { user: { select: { id: true, phone: true, email: true } } },
    });
  }
}
