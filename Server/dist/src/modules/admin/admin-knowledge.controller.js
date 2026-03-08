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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminKnowledgeController = void 0;
const common_1 = require("@nestjs/common");
const knowledge_service_1 = require("../knowledge/knowledge.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
let AdminKnowledgeController = class AdminKnowledgeController {
    constructor(knowledge) {
        this.knowledge = knowledge;
    }
    async list(category, page, pageSize, search, language) {
        return this.knowledge.list(category, parseInt(page || '1', 10), parseInt(pageSize || '20', 10), search, language || 'zh');
    }
    async upload(body) {
        return this.knowledge.create(body);
    }
    async update(id, body) {
        return this.knowledge.update(id, body);
    }
    async delete(id) {
        return this.knowledge.delete(id);
    }
};
exports.AdminKnowledgeController = AdminKnowledgeController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('search')),
    __param(4, (0, common_1.Query)('language')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminKnowledgeController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('upload'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminKnowledgeController.prototype, "upload", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminKnowledgeController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminKnowledgeController.prototype, "delete", null);
exports.AdminKnowledgeController = AdminKnowledgeController = __decorate([
    (0, common_1.Controller)('admin/knowledge'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [knowledge_service_1.KnowledgeService])
], AdminKnowledgeController);
//# sourceMappingURL=admin-knowledge.controller.js.map