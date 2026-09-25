import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FamilyEventService } from './family-event.service';
import { parsePositiveInt } from './pagination.util';

class HelpRequestDto {
  @IsString() groupId!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsString() riskLevel?: string;
  @IsOptional() @IsString() refType?: string;
  @IsOptional() @IsString() refId?: string;
}

class ShareCaseDto {
  @IsString() groupId!: string;
  @IsString() refType!: string;
  @IsString() refId!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsString() riskLevel?: string;
}

class HandleDto {
  @IsIn(['dismissed', 'confirmed_safe', 'checking', 'acknowledged'])
  action!: string;
}

/**
 * V5.1 家庭事件流接口（求助 / 案例分享 / chips 处置）。
 * 路径 /api/family/*，与 FamilyController 不冲突（不同子路径）。
 */
@Controller('family')
@UseGuards(JwtAuthGuard)
export class FamilyEventController {
  constructor(private events: FamilyEventService) {}

  /** 老人求助：把 AI 结论快照发进家庭群 */
  @Post('help-request')
  help(@CurrentUser('sub') userId: string, @Body() dto: HelpRequestDto) {
    return this.events.createHelpRequest(userId, dto);
  }

  /** 案例/情报一键发家人 */
  @Post('share-case')
  share(@CurrentUser('sub') userId: string, @Body() dto: ShareCaseDto) {
    return this.events.shareCase(userId, dto);
  }

  /** chips 处置 */
  @Post('events/:id/handle')
  handle(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: HandleDto) {
    return this.events.handle(userId, id, dto.action);
  }

  /** 群事件流 */
  @Get('groups/:groupId/events')
  list(
    @CurrentUser('sub') userId: string,
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
  ) {
    // 2026-09-07 复核修复：limit=abc 原来变成 NaN 传给 Prisma take → 500
    return this.events.listEvents(userId, groupId, parsePositiveInt(limit, 50, 100));
  }
}
