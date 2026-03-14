/**
 * 强制统一 AI 输出 JSON schema（与规范一致）
 */
export type RiskLevel = 'high' | 'medium' | 'low' | 'unknown';

export const RISK_TYPES = [
  '诈骗',
  '黑灰产',
  '钓鱼网站',
  '投资骗局',
  '兼职骗局',
  '假客服',
  '虚假医疗',
  '老年人骗局',
  '未知风险',
  '诈骗网站',
  '钓鱼诈骗',
  '金融诈骗',
] as const;
export type RiskType = (typeof RISK_TYPES)[number];

export interface AiOutputSchema {
  risk_level: RiskLevel;
  confidence: number;
  risk_type: string[];
  summary: string;
  reasons: string[];
  advice: string[];
}

/** 校验并兜底：无效则返回 unknown + 低置信度 */
export function parseAndValidateAiOutput(raw: string): AiOutputSchema {
  const fallback: AiOutputSchema = {
    risk_level: 'unknown',
    confidence: 50,
    risk_type: ['未知风险'],
    summary: '无法确定风险',
    reasons: ['AI 返回格式异常或无法解析', '请结合其他渠道核实', '勿轻信单方说法'],
    advice: ['请谨慎对待，勿轻信对方', '可向官方渠道求证', '注意保护个人隐私与资金安全'],
  };
  try {
    const cleaned = raw.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const risk_level = (obj.risk_level as string)?.toLowerCase();
    const validLevels: RiskLevel[] = ['high', 'medium', 'low', 'unknown'];
    const level = validLevels.includes(risk_level as RiskLevel) ? (risk_level as RiskLevel) : 'unknown';
    const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(100, obj.confidence)) : 50;
    const risk_type = Array.isArray(obj.risk_type) ? obj.risk_type.map(String) : ['未知风险'];
    const summary = typeof obj.summary === 'string' ? obj.summary : fallback.summary;
    let reasons = Array.isArray(obj.reasons) ? obj.reasons.map(String) : fallback.reasons;
    let advice = Array.isArray(obj.advice) ? obj.advice.map(String) : fallback.advice;
    if (reasons.length < 3) reasons = [...reasons, ...fallback.reasons].slice(0, 3);
    if (advice.length < 3) advice = [...advice, ...fallback.advice].slice(0, 3);
    return { risk_level: level, confidence, risk_type, summary, reasons, advice };
  } catch (e) {
    console.log('[AI_PARSE] 解析失败，使用兜底 fallback | raw 前500字: ' + String(raw).slice(0, 500) + ' | error: ' + (e instanceof Error ? e.message : String(e)));
    return fallback;
  }
}
