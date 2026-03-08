import { Controller, Get, UseGuards } from '@nestjs/common';
import { SubscriptionService } from '../subscription/subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('admin/subscription')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminSubscriptionController {
  constructor(private sub: SubscriptionService) {}

  @Get('logs')
  async logs() {
    return this.sub.getLogs();
  }
}
