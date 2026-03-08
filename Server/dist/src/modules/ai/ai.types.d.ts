export type RiskLevel = 'high' | 'medium' | 'low' | 'unknown';
export declare const RISK_TYPES: readonly ["诈骗", "黑灰产", "钓鱼网站", "投资骗局", "兼职骗局", "假客服", "虚假医疗", "老年人骗局", "未知风险"];
export type RiskType = (typeof RISK_TYPES)[number];
export interface AiOutputSchema {
    risk_level: RiskLevel;
    confidence: number;
    risk_type: string[];
    summary: string;
    reasons: string[];
    advice: string[];
}
export declare function parseAndValidateAiOutput(raw: string): AiOutputSchema;
