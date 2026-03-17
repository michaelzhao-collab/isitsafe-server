import { Controller, Get, Param, Post, Query, UseGuards, Headers } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** 客户端：GET /api/messages 列表，POST /api/messages/:id/read 标记已读；未读数量由前端根据列表与已读记录计算或单独接口 */
function resolveLanguageFromHeader(header?: string): 'zh' | 'en' {
  if (!header) return 'zh';
  const h = header.toLowerCase();
  if (h.startsWith('en')) return 'en';
  if (h.includes('en')) return 'en';
  return 'zh';
}

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser('sub') userId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Headers('x-app-language') langHeader?: string,
  ) {
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const lang = resolveLanguageFromHeader(langHeader);
    const messages = await this.prisma.appMessage.findMany({
      where: { status: 'active', language: lang },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(pageSize, 10),
      include: {
        readBy: { where: { userId }, take: 1 },
      },
    });
    const total = await this.prisma.appMessage.count({ where: { status: 'active', language: lang } });
    const items = messages.map((m) => ({
      id: m.id,
      title: m.title,
      content: m.content,
      link: m.link,
      createdAt: m.createdAt.toISOString(),
      read: m.readBy.length > 0,
    }));
    return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('sub') userId: string, @Headers('x-app-language') langHeader?: string) {
    const lang = resolveLanguageFromHeader(langHeader);
    const allIds = await this.prisma.appMessage.findMany({
      where: { status: 'active', language: lang },
      select: { id: true },
    });
    const readIds = await this.prisma.userMessageRead.findMany({
      where: { userId },
      select: { messageId: true },
    });
    const readSet = new Set(readIds.map((r) => r.messageId));
    const count = allIds.filter((id) => !readSet.has(id.id)).length;
    return { count };
  }

  @Post(':id/read')
  async markRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const msg = await this.prisma.appMessage.findUnique({ where: { id } });
    if (!msg) return { ok: true };
    await this.prisma.userMessageRead.upsert({
      where: {
        userId_messageId: { userId, messageId: id },
      },
      create: { userId, messageId: id },
      update: {},
    });
    return { ok: true };
  }
}
