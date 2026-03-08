"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RISK_TYPES = void 0;
exports.parseAndValidateAiOutput = parseAndValidateAiOutput;
exports.RISK_TYPES = [
    '诈骗',
    '黑灰产',
    '钓鱼网站',
    '投资骗局',
    '兼职骗局',
    '假客服',
    '虚假医疗',
    '老年人骗局',
    '未知风险',
];
function parseAndValidateAiOutput(raw) {
    const fallback = {
        risk_level: 'unknown',
        confidence: 50,
        risk_type: ['未知风险'],
        summary: '无法确定风险',
        reasons: ['AI 返回格式异常或无法解析'],
        advice: ['请谨慎对待，勿轻信对方'],
    };
    try {
        const cleaned = raw.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();
        const obj = JSON.parse(cleaned);
        const risk_level = obj.risk_level?.toLowerCase();
        const validLevels = ['high', 'medium', 'low', 'unknown'];
        const level = validLevels.includes(risk_level) ? risk_level : 'unknown';
        const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(100, obj.confidence)) : 50;
        const risk_type = Array.isArray(obj.risk_type) ? obj.risk_type.map(String) : ['未知风险'];
        const summary = typeof obj.summary === 'string' ? obj.summary : fallback.summary;
        const reasons = Array.isArray(obj.reasons) ? obj.reasons.map(String) : fallback.reasons;
        const advice = Array.isArray(obj.advice) ? obj.advice.map(String) : fallback.advice;
        return { risk_level: level, confidence, risk_type, summary, reasons, advice };
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=ai.types.js.map