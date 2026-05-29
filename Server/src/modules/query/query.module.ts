import { Module } from '@nestjs/common';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { QuotaModule } from '../quota/quota.module';
import { FamilyModule } from '../family/family.module';

@Module({
  imports: [QuotaModule, FamilyModule],
  controllers: [QueryController],
  providers: [QueryService],
  exports: [QueryService],
})
export class QueryModule {}
