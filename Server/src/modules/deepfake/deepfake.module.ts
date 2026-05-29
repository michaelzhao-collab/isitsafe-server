import { Module } from '@nestjs/common';
import { DeepfakeController } from './deepfake.controller';
import { DeepfakeService } from './deepfake.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamilyModule } from '../family/family.module';

@Module({
  imports: [PrismaModule, FamilyModule],
  controllers: [DeepfakeController],
  providers: [DeepfakeService],
  exports: [DeepfakeService],
})
export class DeepfakeModule {}
