import {
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** GET /api/queries - 历史记录（必须登录，只返回当前用户）；DELETE /api/queries/:id - 删除自己的记录 */
@Controller('queries')
export class QueriesController {
  private readonly logger = new Logger(QueriesController.name);

  constructor(private prisma: PrismaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser('sub') userId: string | undefined,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('riskLevel') riskLevel?: string,
    @Query('conversation_id') conversationId?: string,
  ) {
    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('请先登录');
    }
    try {
      const where = { deletedAt: null, userId } as const;
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const pageSizeNum = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 20));
      const select = {
        id: true,
        conversationId: true,
        userId: true,
        inputType: true,
        content: true,
        imageUrl: true,
        resultJson: true,
        riskLevel: true,
        confidence: true,
        aiProvider: true,
        createdAt: true,
      };

      if (conversationId && conversationId.trim()) {
        const items = await this.prisma.query.findMany({
          where: { ...where, conversationId: conversationId.trim() },
          orderBy: { createdAt: 'asc' },
          select,
        });
        return { items, total: items.length, page: 1, pageSize: items.length };
      }

      const whereWithRisk = riskLevel ? { ...where, riskLevel } : where;
      const all = await this.prisma.query.findMany({
        where: whereWithRisk,
        orderBy: { createdAt: 'desc' },
        take: 500,
        select,
      });
      const byConversation = new Map<string, typeof all[0]>();
      for (const row of all) {
        const key = row.conversationId ?? row.id;
        if (!byConversation.has(key)) byConversation.set(key, row);
      }
      const sorted = Array.from(byConversation.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const total = sorted.length;
      const skip = (pageNum - 1) * pageSizeNum;
      const items = sorted.slice(skip, skip + pageSizeNum).map((row) => ({
        ...row,
        id: row.conversationId ?? row.id,
      }));
      return { items, total, page: pageNum, pageSize: pageSizeNum };
    } catch (err) {
      this.logger.error('GET /queries failed', err);
      throw new InternalServerErrorException('获取历史记录失败，请稍后重试');
    }
  }

  /** 按会话删除：软删该 conversation_id 下本用户所有记录（历史列表按会话展示时用） */
  @Delete('conversation/:conversationId')
  @UseGuards(JwtAuthGuard)
  async deleteByConversation(
    @CurrentUser('sub') userId: string | undefined,
    @Param('conversationId') conversationId: string,
  ) {
    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('请先登录');
    }
    try {
      await this.prisma.query.updateMany({
        where: { userId, conversationId: conversationId.trim(), deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return {};
    } catch (err) {
      this.logger.error('DELETE /queries/conversation/:id failed', err);
      throw new InternalServerErrorException('删除失败，请稍后重试');
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser('sub') userId: string | undefined,
    @Param('id') id: string,
  ) {
    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('请先登录');
    }
    try {
      await this.prisma.query.updateMany({
        where: { id, userId },
        data: { deletedAt: new Date() },
      });
      return {};
    } catch (err) {
      this.logger.error('DELETE /queries/:id failed', err);
      throw new InternalServerErrorException('删除失败，请稍后重试');
    }
  }
}
