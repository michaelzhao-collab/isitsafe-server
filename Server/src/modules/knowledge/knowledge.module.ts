import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeV2Controller } from './knowledge.v2.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  controllers: [KnowledgeController, KnowledgeV2Controller],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
