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

const ZH_TO_EN: Record<string, RiskLevel> = {
  高风险: 'high', 高: 'high',
  中风险: 'medium', 中: 'medium',
  低风险: 'low', 低: 'low',
  未知: 'unknown', 未知风险: 'unknown',
};

function normalizeRiskLevel(value: string | undefined): RiskLevel {
  if (!value || typeof value !== 'string') return 'unknown';
  const s = value.trim().toLowerCase();
  const zh = value.trim();
  if (ZH_TO_EN[zh]) return ZH_TO_EN[zh];
  const validLevels: RiskLevel[] = ['high', 'medium', 'low', 'unknown'];
  return validLevels.includes(s as RiskLevel) ? (s as RiskLevel) : 'unknown';
}

/** 与 parse 失败兜底文案一致，供 URL+风险库命中时判断是否替换展示 */
export const AI_PARSE_FALLBACK_SUMMARY = '无法确定风险';
export const AI_PARSE_FALLBACK_REASON_FIRST = 'AI 返回格式异常或无法解析';

export function isAiParseFallbackOutput(o: AiOutputSchema): boolean {
  return (
    o.summary === AI_PARSE_FALLBACK_SUMMARY &&
    Array.isArray(o.reasons) &&
    o.reasons[0] === AI_PARSE_FALLBACK_REASON_FIRST
  );
}

function tryParseJsonObject(raw: string): Record<string, unknown> {
  const stripped = raw.replace(/```json\s?/gi, '').replace(/```\s?/g, '').trim();
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('no json object');
  }
}

/** 校验并兜底：无效则返回 unknown + 低置信度；支持豆包返回中文 risk_level */
export function parseAndValidateAiOutput(raw: string): AiOutputSchema {
  const fallback: AiOutputSchema = {
    risk_level: 'unknown',
    confidence: 50,
    risk_type: ['未知风险'],
    summary: AI_PARSE_FALLBACK_SUMMARY,
    reasons: [
      AI_PARSE_FALLBACK_REASON_FIRST,
      '请结合其他渠道核实',
      '勿轻信单方说法',
    ],
    advice: ['请谨慎对待，勿轻信对方', '可向官方渠道求证', '注意保护个人隐私与资金安全'],
  };
  try {
    const obj = tryParseJsonObject(String(raw ?? ''));
    const level = normalizeRiskLevel((obj.risk_level as string) ?? undefined);
    const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(100, obj.confidence)) : 50;
    const risk_type = Array.isArray(obj.risk_type) ? obj.risk_type.map(String) : ['未知风险'];
    const summary = typeof obj.summary === 'string' ? obj.summary : AI_PARSE_FALLBACK_SUMMARY;
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
