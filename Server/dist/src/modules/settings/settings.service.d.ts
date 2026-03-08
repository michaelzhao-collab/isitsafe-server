import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
export type AiProviderName = 'doubao' | 'openai' | 'other';
export declare class SettingsService {
    private config;
    private prisma;
    constructor(config: ConfigService, prisma: PrismaService);
    getDefaultProvider(): Promise<AiProviderName>;
    getDoubaoKey(): Promise<string | null>;
    getOpenaiKey(): Promise<string | null>;
    getAiBaseUrl(): Promise<string | null>;
    getForAdmin(): Promise<{
        defaultProvider: string;
        hasDoubaoKey: boolean;
        hasOpenaiKey: boolean;
        aiBaseUrl: string | null;
        updatedAt: Date | null;
    }>;
    updateForAdmin(data: {
        defaultProvider?: string;
        doubaoKey?: string | null;
        openaiKey?: string | null;
        aiBaseUrl?: string | null;
    }): Promise<{
        id: string;
        updatedAt: Date;
        defaultProvider: string;
        doubaoKey: string | null;
        openaiKey: string | null;
        aiBaseUrl: string | null;
    }>;
}
