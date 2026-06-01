import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportModule } from '../report/report.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SettingsModule } from '../settings/settings.module';
import { RedisModule } from '../../redis/redis.module';
import { NotificationModule } from '../notification/notification.module';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminQueriesController } from './admin-queries.controller';
import { AdminReportsController } from './admin-reports.controller';
import { AdminKnowledgeController } from './admin-knowledge.controller';
import { AdminKnowledgeCategoryController } from './admin-knowledge-category.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsOverviewController } from './admin-analytics-overview.controller';
import { AdminSubscriptionController } from './admin-subscription.controller';
import { AdminMessagesController } from './admin-messages.controller';
import { AdminFeedbackController } from './admin-feedback.controller';
import { AdminMembershipController } from './admin-membership.controller';
import { AdminRiskDataController } from './admin-risk-data.controller';
import { AdminV3Controller } from './admin-v3.controller';
import { AdminDiagnosticsController } from './admin-diagnostics.controller';
import { AdminPushController } from './admin-push.controller';
import { TurnstileService } from './turnstile.service';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { AdminAuditLogService } from './audit/audit-log.service';

@Module({
  imports: [AuthModule, ReportModule, KnowledgeModule, SubscriptionModule, SettingsModule, RedisModule, NotificationModule],
  controllers: [
    AdminController,
    AdminAuthController,
    AdminUsersController,
    AdminQueriesController,
    AdminReportsController,
    AdminKnowledgeController,
    AdminKnowledgeCategoryController,
    AdminSettingsController,
    AdminAnalyticsController,
    AdminAnalyticsOverviewController,
    AdminSubscriptionController,
    AdminMessagesController,
    AdminFeedbackController,
    AdminMembershipController,
    AdminRiskDataController,
    AdminV3Controller,
    AdminDiagnosticsController,
    AdminPushController,
  ],
  providers: [AdminRoleGuard, AdminAuthService, TurnstileService, AdminAuditLogService],
  exports: [AdminAuditLogService],
})
export class AdminModule {}
