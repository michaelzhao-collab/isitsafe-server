import { Module } from '@nestjs/common';
import { OnboardingPublicController, OnboardingAdminController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  controllers: [OnboardingPublicController, OnboardingAdminController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
