/**
 * V3 #5 意图分流响应生成器
 *
 * 负责：非 scam_detection 意图（general_chat / knowledge_query / help_request）
 * 调对应 prompt，返回 AnalyzeResult-compatible 结构。
 *
 * scam_detection 仍走 ai.service.analyze 原有的完整流程（RAG / 风险库 / 评分）。
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../providers/ai-provider.service';
import { AiOutputSchema } from '../ai.types';
import { getPromptForIntent, Language } from './intent-prompts';
import type { Intent } from './intent-classifier.service';

interface IntentResponse {
  summary?: string;
  steps?: string[];
  actions?: Array<{ label?: string | null; type?: string | null; value?: string }>;
  freeText?: string;
}

@Injectable()
export class IntentResponseService {
  private readonly logger = new Logger(IntentResponseService.name);

  constructor(private aiProvider: AiProviderService) {}

  /**
   * 为非 scam_detection 意图生成响应
   *
   * 返回 AiOutputSchema 兼容（老字段 risk_level/reasons/advice 填中性值
   * 让老客户端不崩；新字段 intent/freeText/steps/actions 提供给新客户端）
   */
  async generate(
    content: string,
    intent: Exclude<Intent, 'scam_detection'>,
    language: Language = 'zh',
  ): Promise<AiOutputSchema> {
    const prompt = getPromptForIntent(intent, language);
    const userPrompt = prompt.user(content);

    let parsed: IntentResponse;
    try {
      const r = await this.aiProvider.analyze(userPrompt, prompt.system);
      parsed = this.safeJsonParse((r?.raw ?? '').trim());
    } catch (err: any) {
      this.logger.warn(`[IntentResponse] ${intent} AI failed: ${err?.message ?? err}`);
      parsed = this.fallbackResponse(intent, language);
    }

    return this.toAiOutputSchema(parsed, intent, language);
  }

  private safeJsonParse(text: string): IntentResponse {
    const stripped = text.replace(/```json\s?/gi, '').replace(/```\s?/g, '').trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const m = stripped.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          /* fall through */
        }
      }
    }
    if (parsed && typeof parsed === 'object') {
      // F3: 过滤掉无 label 且无 type 的脏 action，避免客户端解码失败
      if (Array.isArray(parsed.actions)) {
        parsed.actions = parsed.actions
          .filter((a: any) => a && typeof a === 'object' && (a.label || a.type))
          .map((a: any) => ({
            label: typeof a.label === 'string' ? a.label : null,
            type: typeof a.type === 'string' ? a.type : null,
            value: typeof a.value === 'string' ? a.value : undefined,
          }));
      }
      return parsed;
    }
    // 兜底：把整段当 freeText
    return { freeText: text };
  }

  /**
   * 把 IntentResponse 映射到 AiOutputSchema
   * 老字段填中性默认，让老客户端不崩；新字段反映真实意图响应
   */
  private toAiOutputSchema(
    r: IntentResponse,
    intent: Exclude<Intent, 'scam_detection'>,
    language: Language,
  ): AiOutputSchema {
    const isZh = language === 'zh';
    // 非 scam_detection 意图：risk_level 全部用 'unknown'
    // 老客户端看到 unknown 不会显示红色风险标识，安全
    const summaryFallback = isZh ? '已为你回答' : 'Here is my response';
    const summary = r.summary || r.freeText?.slice(0, 60) || summaryFallback;

    // 老字段填合理默认（兼容老客户端，不会显示空白）
    const reasons = r.steps && r.steps.length > 0
      ? r.steps
      : [r.freeText ?? summary, isZh ? '更多信息请追问' : 'Ask follow-ups for details', ''];
    const advice = r.actions && r.actions.length > 0
      ? r.actions.map((a) => a.label || a.type || '').filter((s) => s.length > 0)
      : (isZh ? ['可继续追问'] : ['Ask me anything']);

    return {
      risk_level: 'unknown',
      confidence: 70,
      risk_type: [isZh ? '非检测' : 'non-detection'],
      summary,
      reasons: reasons.filter((s) => s && s.length > 0).slice(0, 5),
      advice: advice.slice(0, 5),
      is_conversational: intent === 'general_chat',
      // ====== 新字段 ======
      intent,
      // verdict 不设（仅 scam_detection 有）
      steps: r.steps,
      actions: r.actions,
      free_text: r.freeText,
    };
  }

  private fallbackResponse(
    intent: Exclude<Intent, 'scam_detection'>,
    language: Language,
  ): IntentResponse {
    const isZh = language === 'zh';
    switch (intent) {
      case 'general_chat':
        return {
          freeText: isZh
            ? '你好！我是 StarLens 助手，专门帮你识别诈骗。有可疑链接 / 电话 / 消息发给我都能看。'
            : "Hi! I'm StarLens, your anti-scam helper. Send me any suspicious link, number or message.",
        };
      case 'knowledge_query':
        return {
          summary: isZh ? '反诈知识' : 'Anti-fraud knowledge',
          steps: isZh
            ? [
                '诈骗常见手段：冒充客服 / 钓鱼链接 / 投资骗局',
                '识别要点：不轻信、不点击、不转账',
                '遇到时拨打 96110 反诈热线',
              ]
            : [
                'Common scams: fake CS, phishing, fake investment',
                "Don't trust strangers, don't click links, don't transfer",
                'Call fraud hotline 911',
              ],
          actions: [
            {
              label: isZh ? '看案例库' : 'View cases',
              type: 'knowledge',
            },
          ],
        };
      case 'help_request':
        return {
          summary: isZh ? '别慌，按这几步立刻行动' : "Don't panic, act now",
          steps: isZh
            ? [
                '5 分钟内：给银行打电话止付（卡背面客服电话）',
                '30 分钟内：拨打 96110 反诈热线',
                '1 小时内：派出所现场报案',
                '后续：不要相信任何"包追回"的电话，那是二次诈骗',
              ]
            : [
                'Within 5 min: call bank to freeze card',
                'Within 30 min: call fraud hotline 911',
                'Within 1 hour: file police report',
                "Later: ignore 'we can recover money' calls — those are second scams",
              ],
          actions: [
            {
              label: isZh ? '一键拨打 96110' : 'Call 911',
              type: 'call',
              value: isZh ? '96110' : '911',
            },
            {
              label: isZh ? '一键拨打家人' : 'Call family',
              type: 'call_family',
            },
          ],
        };
    }
  }
}
