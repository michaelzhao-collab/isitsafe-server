export declare class AnalyzeTextDto {
    content: string;
    language?: 'zh' | 'en';
    country?: string;
}
export declare class AnalyzeScreenshotDto {
    content: string;
    language?: 'zh' | 'en';
    isScreenshot?: boolean;
    imageUrl?: string;
}
