import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { ChatModerationService } from './chat-moderation.service';
import { parsePositiveInt } from './pagination.util';

/**
 * V5.1 家庭 IM 举报/拉黑管理后台（App Store 1.2 合规：违规处置通道）。
 * 全部 /api/admin/im-moderations/*，需管理员角色。
 */
@Controller('admin/im-moderations')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class ChatAdminController {
  constructor(private moderation: ChatModerationService) {}

  /** 列表（type=report|block；status=pending|reviewed|actioned） */
  @Get()
  list(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    // 2026-09-07 复核修复：非数字入参原来会变成 NaN 传给 Prisma → 500
    return this.moderation.adminList({
      type,
      status,
      page: parsePositiveInt(page, 1),
      pageSize: parsePositiveInt(pageSize, 30, 100),
    });
  }

  /** 统计小卡 */
  @Get('stats')
  stats() {
    return this.moderation.adminStats();
  }

  /** 处置：pending → reviewed | actioned */
  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.moderation.adminUpdateStatus(id, body?.status);
  }
}
