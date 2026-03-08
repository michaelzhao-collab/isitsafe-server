"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSubscriptionController = void 0;
const common_1 = require("@nestjs/common");
const subscription_service_1 = require("../subscription/subscription.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
let AdminSubscriptionController = class AdminSubscriptionController {
    constructor(sub) {
        this.sub = sub;
    }
    async logs() {
        return this.sub.getLogs();
    }
};
exports.AdminSubscriptionController = AdminSubscriptionController;
__decorate([
    (0, common_1.Get)('logs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminSubscriptionController.prototype, "logs", null);
exports.AdminSubscriptionController = AdminSubscriptionController = __decorate([
    (0, common_1.Controller)('admin/subscription'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [subscription_service_1.SubscriptionService])
], AdminSubscriptionController);
//# sourceMappingURL=admin-subscription.controller.js.map