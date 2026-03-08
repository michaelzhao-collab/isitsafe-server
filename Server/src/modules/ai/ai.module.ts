import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { InputParserService } from './parser/input-parser.service';
import { RagKeywordService } from './rag/rag-keyword.service';
import { RiskScoreService } from './risk-engine/risk-score.service';
import { AiPromptsService } from './prompts/ai-prompts.service';
import { AiProviderService } from './providers/ai-provider.service';
import { AiRateLimitGuard } from '../../common/rate-limit/ai-rate-limit.guard';
import { SettingsModule } from '../settings/settings.module';
import { RiskModule } from '../risk/risk.module';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [SettingsModule, RiskModule, MembershipModule],
  controllers: [AiController],
  providers: [
    AiRateLimitGuard,
    AiService,
    InputParserService,
    RagKeywordService,
    RiskScoreService,
    AiPromptsService,
    AiProviderService,
  ],
  exports: [AiService],
})
export class AiModule {}
