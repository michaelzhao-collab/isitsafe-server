"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModule = void 0;
const common_1 = require("@nestjs/common");
const ai_controller_1 = require("./ai.controller");
const ai_service_1 = require("./ai.service");
const input_parser_service_1 = require("./parser/input-parser.service");
const rag_keyword_service_1 = require("./rag/rag-keyword.service");
const risk_score_service_1 = require("./risk-engine/risk-score.service");
const ai_prompts_service_1 = require("./prompts/ai-prompts.service");
const ai_provider_service_1 = require("./providers/ai-provider.service");
const ai_rate_limit_guard_1 = require("../../common/rate-limit/ai-rate-limit.guard");
const settings_module_1 = require("../settings/settings.module");
const risk_module_1 = require("../risk/risk.module");
const membership_module_1 = require("../membership/membership.module");
let AiModule = class AiModule {
};
exports.AiModule = AiModule;
exports.AiModule = AiModule = __decorate([
    (0, common_1.Module)({
        imports: [settings_module_1.SettingsModule, risk_module_1.RiskModule, membership_module_1.MembershipModule],
        controllers: [ai_controller_1.AiController],
        providers: [
            ai_rate_limit_guard_1.AiRateLimitGuard,
            ai_service_1.AiService,
            input_parser_service_1.InputParserService,
            rag_keyword_service_1.RagKeywordService,
            risk_score_service_1.RiskScoreService,
            ai_prompts_service_1.AiPromptsService,
            ai_provider_service_1.AiProviderService,
        ],
        exports: [ai_service_1.AiService],
    })
], AiModule);
//# sourceMappingURL=ai.module.js.map