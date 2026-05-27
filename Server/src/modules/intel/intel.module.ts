import { Module } from '@nestjs/common';
import { IntelController, IntelAdminController } from './intel.controller';
import { IntelService } from './intel.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IntelController, IntelAdminController],
  providers: [IntelService],
  exports: [IntelService],
})
export class IntelModule {}
