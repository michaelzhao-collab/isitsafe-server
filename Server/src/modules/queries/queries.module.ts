import { Module } from '@nestjs/common';
import { QueriesController } from './queries.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  controllers: [QueriesController],
  providers: [JwtAuthGuard],
})
export class QueriesModule {}
