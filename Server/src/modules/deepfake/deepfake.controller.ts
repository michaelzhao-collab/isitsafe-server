import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Sse,
  MessageEvent,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeepfakeService } from './deepfake.service';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Observable } from 'rxjs';

class CreateCheckDto {
  @IsIn(['upload', 'record', 'share'])
  sourceType!: 'upload' | 'record' | 'share';

  @IsString()
  @MaxLength(1000)
  fileUrl!: string;

  @IsOptional()
  @IsNumber()
  fileDurationSec?: number;
}

class FeedbackDto {
  @IsIn(['accurate', 'inaccurate'])
  feedback!: 'accurate' | 'inaccurate';
}

/**
 * V3-A1 语音深伪检测接口
 * 路由前缀：/api/v3/deepfake
 */
@Controller('v3/deepfake')
@UseGuards(JwtAuthGuard)
export class DeepfakeController {
  constructor(private deepfake: DeepfakeService) {}

  /** 创建检测任务（同步返回 stub 结果） */
  @Post('voice')
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateCheckDto) {
    return this.deepfake.createCheck({
      userId,
      sourceType: dto.sourceType,
      fileUrl: dto.fileUrl,
      fileDurationSec: dto.fileDurationSec,
    });
  }

  /** 查询任务结果 */
  @Get('voice/:taskId')
  async getResult(@CurrentUser('sub') userId: string, @Param('taskId') taskId: string) {
    return this.deepfake.getResult(userId, taskId);
  }

  /** 我的检测历史 */
  @Get('voice/history/me')
  async history(@CurrentUser('sub') userId: string, @Query('limit') limit?: string) {
    return this.deepfake.getMyHistory(userId, limit ? parseInt(limit, 10) : 50);
  }

  /** 删除检测记录 */
  @Delete('voice/:taskId')
  async deleteCheck(@CurrentUser('sub') userId: string, @Param('taskId') taskId: string) {
    return this.deepfake.deleteCheck(userId, taskId);
  }

  /** 用户反馈（准/不准） */
  @Post('voice/:taskId/feedback')
  async feedback(
    @CurrentUser('sub') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.deepfake.submitFeedback(userId, taskId, dto.feedback);
  }

  /**
   * S2-4 把检测结果一键广播到家庭（"官方匿名广播"）
   * 同一 taskId 当日只能广播一次（family_broadcasts 部分唯一索引兜底）
   */
  @Post('voice/:taskId/broadcast')
  async broadcast(
    @CurrentUser('sub') userId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.deepfake.broadcastToFamily(userId, taskId);
  }

  /**
   * S2-5 实时结果推送（Server-Sent Events）
   *
   *   PRD 列的 "WS /ws/deepfake"：本仓库无 socket.io 依赖，
   *   一期改用 SSE，路由 GET /api/v3/deepfake/voice/:taskId/stream。
   *   Content-Type: text/event-stream
   *
   * 行为：
   *   - 上一行先吐当前 DB 状态
   *   - status 变化时再吐一次（每 1.5s 轮询一次）
   *   - status = done | failed 时立即 complete 断流
   *   - 60s 超时也断流，客户端可重连
   *
   * 客户端：DeepfakeRepository.streamResult(taskId) 走 URLSession 流式读取，
   * 失败/断流时 fallback 到 GET /voice/:taskId 兜底。
   */
  @Sse('voice/:taskId/stream')
  streamResult(
    @CurrentUser('sub') userId: string,
    @Param('taskId') taskId: string,
  ): Observable<MessageEvent> {
    return this.deepfake.streamResult(userId, taskId);
  }
}
