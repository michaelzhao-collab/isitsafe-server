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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
const optional_jwt_guard_1 = require("../../common/guards/optional-jwt.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const ai_rate_limit_guard_1 = require("../../common/rate-limit/ai-rate-limit.guard");
const analyze_dto_1 = require("./dto/analyze.dto");
let AiController = class AiController {
    constructor(ai) {
        this.ai = ai;
    }
    async analyze(dto, userId) {
        return this.ai.analyze({
            content: dto.content,
            language: dto.language ?? 'zh',
            country: dto.country,
        }, userId ?? null);
    }
    async analyzeScreenshot(dto, userId) {
        return this.ai.analyzeScreenshot(userId ?? null, dto.content, dto.language ?? 'zh', dto.imageUrl);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)('analyze'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [analyze_dto_1.AnalyzeTextDto, String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "analyze", null);
__decorate([
    (0, common_1.Post)('analyze/screenshot'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [analyze_dto_1.AnalyzeScreenshotDto, String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "analyzeScreenshot", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('ai'),
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtAuthGuard, ai_rate_limit_guard_1.AiRateLimitGuard),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiController);
//# sourceMappingURL=ai.controller.js.map