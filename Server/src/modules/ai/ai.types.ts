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
  is_conversational?: boolean;

  // ====== #5 V3 意图分流（老字段保留兼容老客户端）======
  /** 'scam_detection' | 'general_chat' | 'knowledge_query' | 'help_request' */
  intent?: string;
  /** scam_detection 专用：'scam' | 'safe' | 'unknown'（与 risk_level 映射） */
  verdict?: string;
  /** 3-5 句决策性建议（新版风险卡渲染） */
  steps?: string[];
  /** 可点动作按钮（label/type 都可选，避免 AI 漏返时整体解码失败） */
  actions?: Array<{ label?: string | null; type?: string | null; value?: string }>;
  /** general_chat 时的自由文本回答（无 verdict 时由 iOS 渲染纯文本气泡） */
  free_text?: string;
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
/** 英文兜底（防止 EN 响应混入中文） */
export const AI_PARSE_FALLBACK_SUMMARY_EN = 'Could not determine risk';
export const AI_PARSE_FALLBACK_REASON_FIRST_EN = 'AI returned invalid format or could not be parsed';

const FALLBACK_REASONS_ZH = ['请结合其他渠道核实', '勿轻信单方说法', '注意保护个人隐私与资金安全'];
const FALLBACK_ADVICE_ZH = ['请谨慎对待，勿轻信对方', '可向官方渠道求证', '注意保护个人隐私与资金安全'];
const FALLBACK_REASONS_EN = ['Verify through other channels', 'Do not trust a single-source claim', 'Protect personal info and funds'];
const FALLBACK_ADVICE_EN = ['Treat with caution, do not trust easily', 'Verify through official channels', 'Protect personal info and funds'];

export function isAiParseFallbackOutput(o: AiOutputSchema): boolean {
  if (!Array.isArray(o.reasons)) return false;
  const s = o.summary;
  const r0 = o.reasons[0];
  return (
    (s === AI_PARSE_FALLBACK_SUMMARY && r0 === AI_PARSE_FALLBACK_REASON_FIRST) ||
    (s === AI_PARSE_FALLBACK_SUMMARY_EN && r0 === AI_PARSE_FALLBACK_REASON_FIRST_EN)
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

/** 校验并兜底：无效则返回 unknown + 低置信度；支持豆包返回中文 risk_level
 *
 *  i18n：language 决定兜底文案语言，避免英文响应里混入中文兜底（如 '请结合其他渠道核实'）
 */
export function parseAndValidateAiOutput(raw: string, language: 'zh' | 'en' = 'zh'): AiOutputSchema {
  const isZh = language !== 'en';
  const fallbackSummary = isZh ? AI_PARSE_FALLBACK_SUMMARY : AI_PARSE_FALLBACK_SUMMARY_EN;
  const fallbackReasonFirst = isZh ? AI_PARSE_FALLBACK_REASON_FIRST : AI_PARSE_FALLBACK_REASON_FIRST_EN;
  const fallbackReasonsRest = isZh ? FALLBACK_REASONS_ZH : FALLBACK_REASONS_EN;
  const fallbackAdvice = isZh ? FALLBACK_ADVICE_ZH : FALLBACK_ADVICE_EN;
  const fallback: AiOutputSchema = {
    risk_level: 'unknown',
    confidence: 50,
    risk_type: [isZh ? '未知风险' : 'Unknown risk'],
    summary: fallbackSummary,
    reasons: [fallbackReasonFirst, fallbackReasonsRest[0], fallbackReasonsRest[1]],
    advice: [...fallbackAdvice],
  };
  try {
    const obj = tryParseJsonObject(String(raw ?? ''));
    const level = normalizeRiskLevel((obj.risk_level as string) ?? undefined);
    const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(100, obj.confidence)) : 50;
    const risk_type = Array.isArray(obj.risk_type) ? obj.risk_type.map(String) : [isZh ? '未知风险' : 'Unknown risk'];
    const summary = typeof obj.summary === 'string' ? obj.summary : fallbackSummary;
    const is_conversational = obj.is_conversational === true;
    let reasons = Array.isArray(obj.reasons) ? obj.reasons.map(String) : fallback.reasons;
    let advice = Array.isArray(obj.advice) ? obj.advice.map(String) : fallback.advice;
    if (!is_conversational) {
      // 不足 3 条时按当前语言补齐（不再混语言）
      if (reasons.length < 3) reasons = [...reasons, ...fallbackReasonsRest].slice(0, 3);
      if (advice.length < 3) advice = [...advice, ...fallbackAdvice].slice(0, 3);
    }
    return { risk_level: level, confidence, risk_type, summary, reasons, advice, is_conversational };
  } catch (e) {
    console.log('[AI_PARSE] 解析失败，使用兜底 fallback | raw 前500字: ' + String(raw).slice(0, 500) + ' | error: ' + (e instanceof Error ? e.message : String(e)));
    return fallback;
  }
}
