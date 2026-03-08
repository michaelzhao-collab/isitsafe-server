import { ConfigService } from '@nestjs/config';
import { SettingsService, AiProviderName } from '../../settings/settings.service';
export interface AiCallResult {
    raw: string;
    provider: string;
    model: string | null;
    tokens: number | null;
    latencyMs: number;
}
export declare class AiProviderService {
    private config;
    private settings;
    constructor(config: ConfigService, settings: SettingsService);
    getDefaultProvider(): Promise<AiProviderName>;
    private getDoubaoConfig;
    private getOpenAIConfig;
    analyzeWithDoubao(prompt: string, systemPrompt: string): Promise<AiCallResult>;
    analyzeWithOpenAI(prompt: string, systemPrompt: string): Promise<AiCallResult>;
    analyzeWithOther(_prompt: string, _systemPrompt: string): Promise<AiCallResult>;
    analyze(prompt: string, systemPrompt: string, provider?: AiProviderName): Promise<AiCallResult>;
}
