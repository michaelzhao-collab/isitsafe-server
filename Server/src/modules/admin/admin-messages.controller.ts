import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

/** 管理后台：消息管理。添加消息即“发送给所有人”（客户端拉取列表）。 */
export class CreateMessageDto {
  title: string;
  content: string;
  link?: string;
}

@Controller('admin/messages')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminMessagesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const [items, total] = await Promise.all([
      this.prisma.appMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(pageSize, 10),
      }),
      this.prisma.appMessage.count(),
    ]);
    return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
  }

  @Post()
  async create(@Body() dto: CreateMessageDto) {
    const msg = await this.prisma.appMessage.create({
      data: {
        title: dto.title,
        content: dto.content,
        link: dto.link ?? null,
      },
    });
    return msg;
  }
}
