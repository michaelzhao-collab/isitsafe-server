import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** GET /api/queries - 历史记录（必须登录，只返回当前用户）；DELETE /api/queries/:id - 删除自己的记录 */
@Controller('queries')
export class QueriesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser('sub') userId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('riskLevel') riskLevel?: string,
  ) {
    const where: any = { deletedAt: null, userId };
    if (riskLevel) where.riskLevel = riskLevel;
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const [items, total] = await Promise.all([
      this.prisma.query.findMany({
        where,
        skip,
        take: parseInt(pageSize, 10),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.query.count({ where }),
    ]);
    return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.prisma.query.updateMany({
      where: { id, userId },
      data: { deletedAt: new Date() },
    });
    return {};
  }
}
