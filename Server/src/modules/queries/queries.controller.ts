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
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** GET /api/queries - 历史记录（登录用户看自己的，未登录不返回）；DELETE /api/queries/:id - 删除自己的记录 */
@Controller('queries')
@UseGuards(OptionalJwtAuthGuard)
export class QueriesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser('sub') userId: string | undefined,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('riskLevel') riskLevel?: string,
  ) {
    // 未登录不返回任何记录，只返回当前用户自己的
    if (!userId) {
      return { items: [], total: 0, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
    }
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
