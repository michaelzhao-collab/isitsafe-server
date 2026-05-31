/**
 * V3-K Admin 内容抓取 API
 *
 * 路由前缀：/api/admin/content-fetch
 * 鉴权：JwtAuthGuard + AdminRoleGuard
 *
 * 端点：
 *   POST /trigger?type=intel|knowledge  → 触发抓取，返回 { jobId }
 *   GET  /jobs?type=intel&limit=10      → 最近 jobs
 *   GET  /jobs/:id                      → 单个 job 详情（轮询用）
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ContentFetchService } from './content-fetch.service';
import type { SourceCategory } from './sources.config';

@Controller('admin/content-fetch')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class ContentFetchController {
  constructor(private cf: ContentFetchService) {}

  @Post('trigger')
  async trigger(
    @Query('type') type: string,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<{ jobId: string }> {
    const t = this.normalizeType(type);
    if (!adminUserId) throw new BadRequestException('未鉴权');
    return this.cf.trigger(t, adminUserId);
  }

  @Get('jobs')
  async listJobs(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const t = type ? this.normalizeType(type) : undefined;
    const n = limit ? Math.min(parseInt(limit, 10) || 10, 50) : 10;
    return this.cf.listJobs({ type: t, limit: n });
  }

  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    const j = await this.cf.getJob(id);
    if (!j) throw new BadRequestException('job 不存在');
    return j;
  }

  private normalizeType(t: string): SourceCategory {
    if (t === 'intel' || t === 'knowledge') return t;
    throw new BadRequestException("type 必须是 'intel' 或 'knowledge'");
  }
}
