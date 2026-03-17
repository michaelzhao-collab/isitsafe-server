import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

/** 管理后台：消息管理。添加消息时可分别填写中文/英文文案，服务端按 language 拆成多条记录。 */
export class CreateMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  titleZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  contentZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  titleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  contentEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link?: string;

  // link 对中英文共用，同一跳转地址
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
        select: { id: true, title: true, content: true, link: true, language: true, status: true, createdAt: true },
      }),
      this.prisma.appMessage.count(),
    ]);
    return { items, total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10) };
  }

  /** 下架：设为 offline，客户端不再展示 */
  @Patch(':id/offline')
  async setOffline(@Param('id') id: string) {
    await this.prisma.appMessage.update({
      where: { id },
      data: { status: 'offline' },
    });
    return { ok: true };
  }

  @Post()
  async create(@Body() dto: CreateMessageDto) {
    const tasks = [];
    if (dto.titleZh && dto.contentZh) {
      tasks.push(
        this.prisma.appMessage.create({
          data: {
            title: dto.titleZh,
            content: dto.contentZh,
            link: dto.link ?? null,
            language: 'zh',
          },
        }),
      );
    }
    if (dto.titleEn && dto.contentEn) {
      tasks.push(
        this.prisma.appMessage.create({
          data: {
            title: dto.titleEn,
            content: dto.contentEn,
            link: dto.link ?? null,
            language: 'en',
          },
        }),
      );
    }
    if (tasks.length === 0) {
      throw new Error('至少填写中文或英文的一套标题和内容');
    }
    const created = await this.prisma.$transaction(tasks as any);
    return { items: created };
  }
}
