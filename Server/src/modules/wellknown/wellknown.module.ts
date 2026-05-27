import { Module } from '@nestjs/common';
import { WellKnownController } from './wellknown.controller';

@Module({
  controllers: [WellKnownController],
})
export class WellKnownModule {}
