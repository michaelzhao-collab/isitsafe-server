import { Module } from '@nestjs/common';
import { IntelController } from './intel.controller';
import { IntelService } from './intel.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IntelController],
  providers: [IntelService],
  exports: [IntelService],
})
export class IntelModule {}
