import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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

  /** 会员订单列表：分页，可选 status=active|expired|cancelled|all */
  @Get('orders')
  async orders(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
  ) {
    return this.sub.listOrders(parseInt(page, 10), parseInt(pageSize, 10), status);
  }
}
