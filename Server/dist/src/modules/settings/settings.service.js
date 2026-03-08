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
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
let SettingsService = class SettingsService {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
    }
    async getDefaultProvider() {
        const env = this.config.get('AI_PROVIDER');
        if (env && ['doubao', 'openai', 'other'].includes(env))
            return env;
        try {
            const row = await this.prisma.settings.findFirst();
            if (row?.defaultProvider)
                return row.defaultProvider;
        }
        catch { }
        return 'doubao';
    }
    async getDoubaoKey() {
        const env = this.config.get('DOUBAO_API_KEY');
        if (env)
            return env;
        try {
            const row = await this.prisma.settings.findFirst();
            return row?.doubaoKey ?? null;
        }
        catch {
            return null;
        }
    }
    async getOpenaiKey() {
        const env = this.config.get('OPENAI_API_KEY');
        if (env)
            return env;
        try {
            const row = await this.prisma.settings.findFirst();
            return row?.openaiKey ?? null;
        }
        catch {
            return null;
        }
    }
    async getAiBaseUrl() {
        const env = this.config.get('AI_BASE_URL');
        if (env)
            return env;
        try {
            const row = await this.prisma.settings.findFirst();
            return row?.aiBaseUrl ?? null;
        }
        catch {
            return null;
        }
    }
    async getForAdmin() {
        const row = await this.prisma.settings.findFirst();
        const envProvider = this.config.get('AI_PROVIDER');
        const envDoubao = this.config.get('DOUBAO_API_KEY');
        const envOpenai = this.config.get('OPENAI_API_KEY');
        const envBase = this.config.get('AI_BASE_URL');
        return {
            defaultProvider: row?.defaultProvider ?? envProvider ?? 'doubao',
            hasDoubaoKey: !!(row?.doubaoKey ?? envDoubao),
            hasOpenaiKey: !!(row?.openaiKey ?? envOpenai),
            aiBaseUrl: row?.aiBaseUrl ?? envBase ?? null,
            updatedAt: row?.updatedAt ?? null,
        };
    }
    async updateForAdmin(data) {
        let row = await this.prisma.settings.findFirst();
        if (!row) {
            row = await this.prisma.settings.create({
                data: {
                    defaultProvider: data.defaultProvider ?? 'doubao',
                    doubaoKey: data.doubaoKey ?? null,
                    openaiKey: data.openaiKey ?? null,
                    aiBaseUrl: data.aiBaseUrl ?? null,
                },
            });
        }
        else {
            row = await this.prisma.settings.update({
                where: { id: row.id },
                data: {
                    defaultProvider: data.defaultProvider ?? undefined,
                    doubaoKey: data.doubaoKey !== undefined ? data.doubaoKey : undefined,
                    openaiKey: data.openaiKey !== undefined ? data.openaiKey : undefined,
                    aiBaseUrl: data.aiBaseUrl !== undefined ? data.aiBaseUrl : undefined,
                },
            });
        }
        return row;
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map