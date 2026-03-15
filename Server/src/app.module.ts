import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
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
  ],
})
export class AppModule {}
