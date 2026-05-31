/**
 * V4-P0 AI 分析评测 Admin API
 *
 * 路由：/api/admin/ai-evaluation
 * 鉴权：JwtAuthGuard + AdminRoleGuard
 *
 * 端点：
 *   GET  /samples?promptVersion=&intent=&scored=yes|no|all&page=&pageSize=
 *   GET  /samples/:id
 *   PUT  /samples/:id/score   body: { score: 1-5, label?, notes? }
 *   GET  /stats               按 promptVersion 分组的总数 / 已评数 / 平均分
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiEvaluationService } from './ai-evaluation.service';

@Controller('admin/ai-evaluation')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AiEvaluationController {
  constructor(private aiEval: AiEvaluationService) {}

  @Get('samples')
  async list(
    @Query('promptVersion') promptVersion?: string,
    @Query('intent') intent?: string,
    @Query('scored') scored?: 'yes' | 'no' | 'all',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.aiEval.list({
      promptVersion,
      intent,
      scored: scored ?? 'all',
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get('samples/:id')
  async getOne(@Param('id') id: string) {
    const s = await this.aiEval.getById(id);
    if (!s) throw new BadRequestException('样本不存在');
    return s;
  }

  @Put('samples/:id/score')
  async score(
    @Param('id') id: string,
    @Body() body: { score: number; label?: string; notes?: string },
    @CurrentUser('sub') adminUserId: string,
  ) {
    const score = parseInt(String(body.score), 10);
    if (Number.isNaN(score) || score < 1 || score > 5) {
      throw new BadRequestException('score 必须是 1-5');
    }
    return this.aiEval.score(id, {
      adminUserId,
      score,
      label: body.label,
      notes: body.notes,
    });
  }

  @Get('stats')
  async stats() {
    return this.aiEval.statsByVersion();
  }
}
