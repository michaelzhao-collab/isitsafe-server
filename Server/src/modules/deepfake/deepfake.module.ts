import { Module } from '@nestjs/common';
import { DeepfakeController } from './deepfake.controller';
import { DeepfakeService } from './deepfake.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DeepfakeController],
  providers: [DeepfakeService],
  exports: [DeepfakeService],
})
export class DeepfakeModule {}
