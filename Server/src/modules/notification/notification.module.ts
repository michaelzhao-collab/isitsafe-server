import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * 全局通知模块（push / sms 抽象层）
 * 任何模块通过 NotificationService 发通知，底层 provider 切换不影响调用方
 */
@Module({
  imports: [PrismaModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
