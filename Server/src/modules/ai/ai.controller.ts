import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiRateLimitGuard } from '../../common/rate-limit/ai-rate-limit.guard';
import { AnalyzeTextDto, AnalyzeScreenshotDto } from './dto/analyze.dto';

/**
 * POST /api/ai/analyze - 文本/电话/链接/公司 分析（未登录也可调用）
 * POST /api/ai/analyze/screenshot - 截图分析（可传 OCR 后文本或 base64）
 */
@Controller('ai')
@UseGuards(OptionalJwtAuthGuard, AiRateLimitGuard)
export class AiController {
  constructor(private ai: AiService) {}

  @Post('analyze')
  async analyze(
    @Body() dto: AnalyzeTextDto,
    @CurrentUser('sub') userId?: string,
  ) {
    console.log('[AI_API] POST /api/ai/analyze contentLen=' + (dto?.content?.length ?? 0) + ' preview=' + JSON.stringify((dto?.content ?? '').slice(0, 80)));
    return this.ai.analyze(
      {
        content: dto.content,
        language: dto.language ?? 'zh',
        country: dto.country,
        conversationId: dto.conversation_id,
      },
      userId ?? null,
    );
  }

  @Post('analyze/screenshot')
  async analyzeScreenshot(
    @Body() dto: AnalyzeScreenshotDto,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.ai.analyzeScreenshot(
      userId ?? null,
      dto.content,
      dto.language ?? 'zh',
      dto.imageUrl,
      dto.conversation_id,
    );
  }
}
