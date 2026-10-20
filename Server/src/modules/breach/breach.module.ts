import { Module } from '@nestjs/common';
import { BreachController } from './breach.controller';
import { BreachService } from './breach.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { OverseaOnlyGuard } from '../../common/guards/oversea-only.guard';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [PrismaModule, MailModule, QuotaModule],
  controllers: [BreachController],
  providers: [BreachService, OverseaOnlyGuard],
  exports: [BreachService],
})
export class BreachModule {}
