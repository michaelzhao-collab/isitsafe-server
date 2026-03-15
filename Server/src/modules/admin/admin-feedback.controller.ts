import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminFeedbackController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const [items, total] = await Promise.all([
      this.prisma.userFeedback.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize, 10),
      }),
      this.prisma.userFeedback.count(),
    ]);
    return {
      items: items.map((i) => ({
        id: i.id,
        userId: i.userId,
        content: i.content,
        imageUrl: i.imageUrl,
        createdAt: i.createdAt.toISOString(),
      })),
      total,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    };
  }
}
