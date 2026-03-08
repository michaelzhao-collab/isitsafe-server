import { SettingsService } from '../settings/settings.service';
export declare class AdminSettingsController {
    private settings;
    constructor(settings: SettingsService);
    get(): Promise<{
        defaultProvider: string;
        hasDoubaoKey: boolean;
        hasOpenaiKey: boolean;
        aiBaseUrl: string | null;
        updatedAt: Date | null;
    }>;
    update(body: {
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
