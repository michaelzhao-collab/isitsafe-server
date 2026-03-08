"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const report_module_1 = require("../report/report.module");
const knowledge_module_1 = require("../knowledge/knowledge.module");
const subscription_module_1 = require("../subscription/subscription.module");
const settings_module_1 = require("../settings/settings.module");
const admin_controller_1 = require("./admin.controller");
const admin_users_controller_1 = require("./admin-users.controller");
const admin_queries_controller_1 = require("./admin-queries.controller");
const admin_reports_controller_1 = require("./admin-reports.controller");
const admin_knowledge_controller_1 = require("./admin-knowledge.controller");
const admin_settings_controller_1 = require("./admin-settings.controller");
const admin_analytics_controller_1 = require("./admin-analytics.controller");
const admin_subscription_controller_1 = require("./admin-subscription.controller");
const admin_messages_controller_1 = require("./admin-messages.controller");
const admin_membership_controller_1 = require("./admin-membership.controller");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [report_module_1.ReportModule, knowledge_module_1.KnowledgeModule, subscription_module_1.SubscriptionModule, settings_module_1.SettingsModule],
        controllers: [
            admin_controller_1.AdminController,
            admin_users_controller_1.AdminUsersController,
            admin_queries_controller_1.AdminQueriesController,
            admin_reports_controller_1.AdminReportsController,
            admin_knowledge_controller_1.AdminKnowledgeController,
            admin_settings_controller_1.AdminSettingsController,
            admin_analytics_controller_1.AdminAnalyticsController,
            admin_subscription_controller_1.AdminSubscriptionController,
            admin_messages_controller_1.AdminMessagesController,
            admin_membership_controller_1.AdminMembershipController,
        ],
        providers: [admin_role_guard_1.AdminRoleGuard],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map