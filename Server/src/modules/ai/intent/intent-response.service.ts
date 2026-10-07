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
import { getRegionHotline, normalizeCountry, RegionHotline } from '../hotlines';

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
    context?: Array<{ role: string; content: string }>,
    country?: string,
  ): Promise<AiOutputSchema> {
    const hotline = getRegionHotline(country, language);
    const prompt = this.localizeHotline(getPromptForIntent(intent, language), hotline, country, language);
    // 拼上下文：前 N 轮 user/assistant 用纯文本形式注入 user prompt 前
    // 避免 "需要" 这种短句续问完全丢上下文
    const contextPrefix = this.buildContextPrefix(context, language);
    const userPrompt = contextPrefix + prompt.user(content);

    let parsed: IntentResponse;
    try {
      const r = await this.aiProvider.analyze(userPrompt, prompt.system);
      parsed = this.safeJsonParse((r?.raw ?? '').trim());
    } catch (err: any) {
      this.logger.warn(`[IntentResponse] ${intent} AI failed: ${err?.message ?? err}`);
      parsed = this.fallbackResponse(intent, language, hotline);
    }

    return this.toAiOutputSchema(parsed, intent, language);
  }

  /** 把上下文转成可读文本块，注入 user prompt 前
   *  - 优先保留最近 N 条（用户最在意的关联）
   *  - 剥掉 iOS 端加的 [intent:X|risk:Y] 内部标签（仅服务端用，AI 看了无意义）
   *  - 单轮 ≤ 500 字、总 ≤ 16000 字（与 iOS buildContext 上限对齐）
   */
  private buildContextPrefix(
    context: Array<{ role: string; content: string }> | undefined,
    language: Language,
  ): string {
    if (!Array.isArray(context) || context.length === 0) return '';
    const isZh = language === 'zh';
    let used = 0;
    const linesReversed: string[] = [];
    // 倒序遍历，优先保留最新的几轮（被裁也是裁最早的）
    for (let i = context.length - 1; i >= 0; i--) {
      const m = context[i];
      const tag = m.role === 'user' ? (isZh ? '用户：' : 'User: ') : (isZh ? '助手：' : 'Assistant: ');
      // 剥掉 [intent:...] 服务端内部标签
      const cleaned = String(m.content ?? '').replace(/^\s*\[intent:[^\]]*\]\s*/i, '');
      const text = cleaned.slice(0, 500);
      const cost = tag.length + text.length;
      if (used + cost > 16000) break;
      used += cost;
      linesReversed.push(`${tag}${text}`);
    }
    if (linesReversed.length === 0) return '';
    // 反转回时间正序
    const lines = linesReversed.reverse();
    return (isZh
      ? `【上下文：以上是用户最近的对话，请结合上下文回答下一句】\n`
      : `[Context: Recent conversation. Answer the next question accordingly]\n`
    ) + lines.join('\n') + '\n\n';
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

    // general_chat：默认清空 actions（避免每条都弹"查个号码"骚扰）
    // 真要让用户查号码，他自己会发消息；不需要每条都贴入口
    const finalActions = intent === 'general_chat' ? [] : (r.actions ?? []);

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
      actions: finalActions,
      free_text: r.freeText,
    };
  }

  /**
   * 2026-10-07 复核 P2-23：提示词里写死的 96110 / 「Call 911」按地区替换。
   * 英文：示例按钮 "Call 911" → 地区热线（没有可拨号码的地区删掉按钮示例）；中文：非中国大陆且有热线的地区把 96110 换成当地号码。
   * 国内 zh 用户（country 为空或 CN）提示词原样不动。
   */
  private localizeHotline(
    prompt: { system: string; user: (input: string) => string },
    hotline: RegionHotline,
    country: string | undefined,
    language: Language,
  ): { system: string; user: (input: string) => string } {
    let system = prompt.system;
    const code = normalizeCountry(country);
    if (language === 'en') {
      const line = /\s*,?\s*\{"label": "Call 911", "type": "call", "value": "911"\}/g;
      system = hotline.dial
        ? system.replace(line, (m) => m.replace('Call 911', hotline.label).replace('"911"', `"${hotline.dial}"`))
        : system.replace(line, '');
      // 复核：整句替换而不是只换数字，否则会出现「0300 123 2040 in US」「Call FTC emergency」这类错文
      const fraudLine = hotline.dial ? `${hotline.dial} (${hotline.label.replace(/^Call /, '')})` : 'your local police or anti-fraud authority';
      system = system
        .replace('Call fraud hotline (911 in US / local equivalent) NOW', `Call ${fraudLine} NOW`)
        .replace('Also call 911 emergency: report it as fraud, get a case number', 'Also report to the local police: say it is fraud, get a case number')
        .replace('Call 911 emergency directly — all 911 lines accept fraud reports', `Call ${fraudLine} directly — report it as fraud`)
        .replace(/\b911\b/g, hotline.dial ?? 'your local police');
    } else if (code && code !== 'CN') {
      // 中文但不在中国大陆：96110 / 110 / 公安 / 派出所 都不适用。有当地热线就换号码，没有就换成「当地警方」
      system = system
        .replace(/96110/g, hotline.dial ?? '当地警方或反诈机构')
        .replace(/拨打 110/g, hotline.dial ? `拨打当地报警电话` : '拨打当地报警电话')
        .replace(/要求公安启动紧急冻结通道（公安有权直接冻结对方账户，比银行权限更大）/g, '请求警方协助冻结对方账户')
        .replace(/派出所/g, '当地警局')
        .replace(/用'国家反诈中心'App[^"」]*?，App 内部直连公安/g, '向当地反诈机构在线举报');
    }
    return { system, user: prompt.user };
  }

  private fallbackResponse(
    intent: Exclude<Intent, 'scam_detection'>,
    language: Language,
    hotline: RegionHotline,
  ): IntentResponse {
    const isZh = language === 'zh';
    const callAction = hotline.dial ? [{ label: hotline.label, type: 'call', value: hotline.dial }] : [];
    switch (intent) {
      case 'general_chat':
        return {
          freeText: isZh
            ? '你好！我是星识安全助手，专门帮你识别诈骗。有可疑链接 / 电话 / 消息发给我都能看。'
            : "Hi! I'm StarLens, your anti-scam helper. Send me any suspicious link, number or message.",
        };
      case 'knowledge_query':
        return {
          summary: isZh ? '反诈知识' : 'Anti-fraud knowledge',
          steps: isZh
            ? [
                '诈骗常见手段：冒充客服 / 钓鱼链接 / 投资骗局',
                '识别要点：不轻信、不点击、不转账',
                hotline.text,
              ]
            : [
                'Common scams: fake CS, phishing, fake investment',
                "Don't trust strangers, don't click links, don't transfer",
                hotline.text,
              ],
          // knowledge action 暂时不下发：iOS 端跳转无法精准定位到对应案例，体验差
          // 待后续把 knowledge action 带上 caseId 后再恢复
        };
      case 'help_request':
        return {
          summary: isZh ? '别慌，按这几步立刻行动' : "Don't panic, act now",
          steps: isZh
            ? [
                '5 分钟内：给银行打电话止付（卡背面客服电话）',
                `30 分钟内：${hotline.dial ? `拨打 ${hotline.dial} 反诈 / 报案热线` : '向当地警方或反诈机构报案'}`,
                '1 小时内：到就近警局 / 派出所现场报案',
                '后续：不要相信任何"包追回"的电话，那是二次诈骗',
              ]
            : [
                'Within 5 min: call bank to freeze card',
                `Within 30 min: ${hotline.dial ? `call ${hotline.dial} (anti-fraud / police line)` : 'report to your local police or anti-fraud authority'}`,
                'Within 1 hour: file police report',
                "Later: ignore 'we can recover money' calls — those are second scams",
              ],
          // call_family 由 iOS 端按用户家庭组状态过滤；fallback 不主动加，避免没家庭的用户看到迷惑
          actions: callAction,
        };
    }
  }
}
