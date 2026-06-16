import { Module } from '@nestjs/common';
import { IntelController, IntelAdminController } from './intel.controller';
import { IntelService } from './intel.service';
import { IntelTranslationService } from './intel-translation.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [IntelController, IntelAdminController],
  providers: [IntelService, IntelTranslationService],
  exports: [IntelService],
})
export class IntelModule {}
