import { Module } from '@nestjs/common';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { MembershipCronService } from './membership-cron.service';

@Module({
  controllers: [MembershipController],
  providers: [MembershipService, MembershipCronService],
  exports: [MembershipService],
})
export class MembershipModule {}
