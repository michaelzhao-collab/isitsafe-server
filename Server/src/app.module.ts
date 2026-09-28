import { Module, Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CfThrottlerGuard } from './common/throttler/cf-throttler.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { UploadModule } from './modules/upload/upload.module';
import { AiModule } from './modules/ai/ai.module';
import { RiskModule } from './modules/risk/risk.module';
import { QueryModule } from './modules/query/query.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { MembershipModule } from './modules/membership/membership.module';
import { ReportModule } from './modules/report/report.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AdminModule } from './modules/admin/admin.module';
import { QueriesModule } from './modules/queries/queries.module';
import { MessagesModule } from './modules/messages/messages.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { SettingsModule } from './modules/settings/settings.module';
import { HealthModule } from './modules/health/health.module';
import { FamilyModule } from './modules/family/family.module';
import { ChatModule } from './modules/chat/chat.module';
import { WellKnownModule } from './modules/wellknown/wellknown.module';
import { IntelModule } from './modules/intel/intel.module';
import { DeepfakeModule } from './modules/deepfake/deepfake.module';
import { BreachModule } from './modules/breach/breach.module';
import { ContentFetchModule } from './modules/content-fetch/content-fetch.module';
import { AiEvaluationModule } from './modules/ai-evaluation/ai-evaluation.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

/** 公开配置接口：GET /api/config，无需鉴权，供 iOS 读取服务端配置 */
@Controller('config')
class PublicConfigController {
  @Get()
  getPublicConfig() {
    return {
      freeQueriesPerDay: Number(process.env.FREE_DAILY_LIMIT ?? '5'),
      // V5.1 家庭群聊紧急回退开关：设 CHAT_ENABLED=false 让客户端回退旧官方消息页
      familyChatEnabled: process.env.CHAT_ENABLED !== 'false',
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // 2026-09-27 复核：默认每 IP 120 次/分钟（真实 IP 见 CfThrottlerGuard）。
    // 家庭/办公室 NAT 出口共用一个 IP，故留足余量；敏感端点用 @Throttle 单独收紧。
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    UserModule,
    UploadModule,
    AiModule,
    RiskModule,
    QueryModule,
    SubscriptionModule,
    MembershipModule,
    ReportModule,
    KnowledgeModule,
    QueriesModule,
    MessagesModule,
    FeedbackModule,
    AdminModule,
    SettingsModule,
    HealthModule,
    FamilyModule,
    ChatModule,
    WellKnownModule,
    IntelModule,
    DeepfakeModule,
    BreachModule,
    ContentFetchModule,
    AiEvaluationModule,
    OnboardingModule,
  ],
  controllers: [PublicConfigController],
  providers: [{ provide: APP_GUARD, useClass: CfThrottlerGuard }],
})
export class AppModule {}
