import { Module } from '@nestjs/common';
import { QueriesController } from './queries.controller';

@Module({
  controllers: [QueriesController],
})
export class QueriesModule {}
