import { Module } from '@nestjs/common';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';
import { FamilyCronService } from './family-cron.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

/**
 * V3-E 家庭守护模块（一期）
 *
 * 三大机制：
 *  ① 免费家庭组（关系网络）
 *  ② 关怀机制（活跃监控 + 2/3 天未活跃自动 push/sms）
 *  ③ 官方匿名广播（不显示触发者，按 AI 真实结果发）
 *
 * 暴露 12 个 V3 接口，全部走 /api/v3/family/*
 * 关怀 cron：每天凌晨 1:00 扫描不活跃成员
 */
@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [FamilyController],
  providers: [FamilyService, FamilyCronService],
  exports: [FamilyService],
})
export class FamilyModule {}
