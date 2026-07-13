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
    return this.dailyScam.list({
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 30,
    });
  }

  @Post()
  create(
    @Body()
    body: {
      title: string;
      summary: string;
      riskLevel?: string;
      refType?: string | null;
      refId?: string | null;
      deepLink?: string | null;
      scheduledDate: string;
    },
  ) {
    return this.dailyScam.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      summary?: string;
      riskLevel?: string;
      deepLink?: string | null;
      scheduledDate?: string;
    },
  ) {
    return this.dailyScam.update(id, body);
  }

  /** 审核：approve | reject */
  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject' },
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
