import { Module } from '@nestjs/common';
import { ReportModule } from '../report/report.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminController } from './admin.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminQueriesController } from './admin-queries.controller';
import { AdminReportsController } from './admin-reports.controller';
import { AdminKnowledgeController } from './admin-knowledge.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminSubscriptionController } from './admin-subscription.controller';
import { AdminMessagesController } from './admin-messages.controller';
import { AdminMembershipController } from './admin-membership.controller';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Module({
  imports: [ReportModule, KnowledgeModule, SubscriptionModule, SettingsModule],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminQueriesController,
    AdminReportsController,
    AdminKnowledgeController,
    AdminSettingsController,
    AdminAnalyticsController,
    AdminSubscriptionController,
    AdminMessagesController,
    AdminMembershipController,
  ],
  providers: [AdminRoleGuard],
})
export class AdminModule {}
