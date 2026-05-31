import { Module } from '@nestjs/common';
import { AiEvaluationController } from './ai-evaluation.controller';
import { AiEvaluationService } from './ai-evaluation.service';

@Module({
  controllers: [AiEvaluationController],
  providers: [AiEvaluationService],
  exports: [AiEvaluationService],
})
export class AiEvaluationModule {}
