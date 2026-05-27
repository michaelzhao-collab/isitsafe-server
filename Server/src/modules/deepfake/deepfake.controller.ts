import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeepfakeService } from './deepfake.service';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
