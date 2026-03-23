import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('subscription')
export class SubscriptionController {
  constructor(private sub: SubscriptionService) {}

  /** Apple 服务器通知（App Store Server Notifications V2）：正式与沙盒均回调此地址，无需 JWT */
  @Post('apple-notification')
  @Public()
  async appleNotification(@Body() body: Record<string, unknown>) {
    await this.sub.handleAppleNotification(body);
    return {};
  }

  /** Apple 服务器通知（推荐路径别名） */
  @Post('apple/notifications')
  @Public()
  async appleNotifications(@Body() body: Record<string, unknown>) {
    await this.sub.handleAppleNotification(body);
    return {};
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUser('sub') userId: string) {
    return this.sub.getStatus(userId);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(@CurrentUser('sub') userId: string) {
    return this.sub.refresh(userId);
  }
}
