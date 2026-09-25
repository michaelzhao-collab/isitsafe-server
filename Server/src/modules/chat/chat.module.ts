import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatRealtimeService } from './chat-realtime.service';
import { ChatMediaCleanupService } from './chat-media-cleanup.service';
import { ChatModerationService } from './chat-moderation.service';
import { ChatAdminController } from './chat-admin.controller';
import { FamilyEventService } from './family-event.service';
import { FamilyEventController } from './family-event.controller';
import { DailyScamService } from './daily-scam.service';
import { DailyScamAdminController } from './daily-scam-admin.controller';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

/**
 * V5.1 自建轻量 IM 模块。
 *  - ChatController：消息收发/同步 REST（唯一事实源出入口）
 *  - ChatGateway：WebSocket 信号下推（加速器，可降级为轮询）
 *  - ChatRealtimeService：连接注册表（gateway 写、service 读，解耦）
 *  - ChatService：seq 事务 / 发送 / 拉取 / 已读 / 撤回 / 未读汇总
 *
 * ChatService 导出，供 family-event / 群生命周期同步注入发系统卡片。
 */
@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [
    ChatController,
    FamilyEventController,
    ChatAdminController,
    DailyScamAdminController,
  ],
  providers: [
    ChatService,
    ChatGateway,
    ChatRealtimeService,
    // 2026-09-07 复核修复：撤回时删除 R2 上的语音/图片对象
    ChatMediaCleanupService,
    ChatModerationService,
    FamilyEventService,
    DailyScamService,
    AdminRoleGuard,
    Reflector,
  ],
  exports: [ChatService, FamilyEventService],
})
export class ChatModule {}
