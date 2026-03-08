import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private sub: SubscriptionService) {}

  @Post('verify')
  async verify(
    @CurrentUser('sub') userId: string,
    @Body('productId') productId: string,
    @Body('receipt') receipt: string,
    @Body('paymentMethod') paymentMethod: 'Apple' | 'Google' = 'Apple',
    @Body('transactionId') transactionId?: string,
  ) {
    return this.sub.verify(userId, productId, receipt, paymentMethod, transactionId);
  }

  @Get('status')
  async status(@CurrentUser('sub') userId: string) {
    return this.sub.getStatus(userId);
  }

  @Post('refresh')
  async refresh(@CurrentUser('sub') userId: string) {
    return this.sub.refresh(userId);
  }
}
