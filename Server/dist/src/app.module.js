"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const throttler_1 = require("@nestjs/throttler");
const auth_module_1 = require("./modules/auth/auth.module");
const user_module_1 = require("./modules/user/user.module");
const upload_module_1 = require("./modules/upload/upload.module");
const ai_module_1 = require("./modules/ai/ai.module");
const risk_module_1 = require("./modules/risk/risk.module");
const query_module_1 = require("./modules/query/query.module");
const subscription_module_1 = require("./modules/subscription/subscription.module");
const membership_module_1 = require("./modules/membership/membership.module");
const report_module_1 = require("./modules/report/report.module");
const knowledge_module_1 = require("./modules/knowledge/knowledge.module");
const admin_module_1 = require("./modules/admin/admin.module");
const queries_module_1 = require("./modules/queries/queries.module");
const messages_module_1 = require("./modules/messages/messages.module");
const settings_module_1 = require("./modules/settings/settings.module");
const health_module_1 = require("./modules/health/health.module");
const prisma_module_1 = require("./prisma/prisma.module");
const redis_module_1 = require("./redis/redis.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            schedule_1.ScheduleModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            upload_module_1.UploadModule,
            ai_module_1.AiModule,
            risk_module_1.RiskModule,
            query_module_1.QueryModule,
            subscription_module_1.SubscriptionModule,
            membership_module_1.MembershipModule,
            report_module_1.ReportModule,
            knowledge_module_1.KnowledgeModule,
            queries_module_1.QueriesModule,
            messages_module_1.MessagesModule,
            admin_module_1.AdminModule,
            settings_module_1.SettingsModule,
            health_module_1.HealthModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map