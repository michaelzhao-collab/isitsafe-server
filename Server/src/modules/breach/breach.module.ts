import { Module } from '@nestjs/common';
import { BreachController } from './breach.controller';
import { BreachService } from './breach.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BreachController],
  providers: [BreachService],
  exports: [BreachService],
})
export class BreachModule {}
