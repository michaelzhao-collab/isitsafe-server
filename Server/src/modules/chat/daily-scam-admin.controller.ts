import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DailyScamService } from './daily-scam.service';
import {
  CreateDailyScamDto,
  ReviewDailyScamDto,
  UpdateDailyScamDto,
} from './dto/daily-scam.dto';
import { parsePositiveInt } from './pagination.util';

/**
 * V5.1 每日一骗"明日一骗"审核队列后台（决策 #5：人工确认才发）。
 * 全部 /api/admin/daily-scam/*，需管理员角色。
 */
@Controller('admin/daily-scam')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class DailyScamAdminController {
  constructor(private dailyScam: DailyScamService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    // 2026-09-07 复核修复：非数字入参原来会变成 NaN 传给 Prisma → 500
    return this.dailyScam.list({
      status,
      page: parsePositiveInt(page, 1),
      pageSize: parsePositiveInt(pageSize, 30, 100),
    });
  }

  // 2026-09-07 复核修复：以下 @Body() 原为内联 TS 类型，全局 ValidationPipe
  // 对非 class 不生效，等于零校验。改用 DTO 类补上 @IsIn / @Matches 等约束。
  @Post()
  create(@Body() body: CreateDailyScamDto) {
    return this.dailyScam.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateDailyScamDto) {
    return this.dailyScam.update(id, body);
  }

  /** 审核：approve | reject */
  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() body: ReviewDailyScamDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.dailyScam.review(id, body.action, adminId);
  }

  /** 立即发送（已 approved 的候选，绕过等 cron） */
  @Post(':id/send-now')
  async sendNow(@Param('id') id: string) {
    const groups = await this.dailyScam.sendCandidate(id);
    return { success: true, groups };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dailyScam.remove(id);
  }
}
