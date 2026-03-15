import { Module } from '@nestjs/common';
import { QueriesController } from './queries.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [QueriesController],
  providers: [JwtAuthGuard],
})
export class QueriesModule {}
