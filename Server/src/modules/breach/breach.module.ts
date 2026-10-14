import { Module } from '@nestjs/common';
import { BreachController } from './breach.controller';
import { BreachService } from './breach.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { OverseaOnlyGuard } from '../../common/guards/oversea-only.guard';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [BreachController],
  providers: [BreachService, OverseaOnlyGuard],
  exports: [BreachService],
})
export class BreachModule {}
