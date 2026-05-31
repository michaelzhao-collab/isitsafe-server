import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ContentFetchController } from './content-fetch.controller';
import { ContentFetchService } from './content-fetch.service';
import { FetcherService } from './fetcher.service';
import { RewriterService } from './rewriter.service';

@Module({
  imports: [AiModule],
  controllers: [ContentFetchController],
  providers: [ContentFetchService, FetcherService, RewriterService],
  exports: [ContentFetchService],
})
export class ContentFetchModule {}
