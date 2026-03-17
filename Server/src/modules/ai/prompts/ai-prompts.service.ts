/**
 * AI 系统/用户 Prompt 构建
 * 强制 AI 只返回 JSON，严格符合 schema
 */
import { Injectable } from '@nestjs/common';
import type { KnowledgeCaseHit } from '../rag/rag-keyword.service';

const SCHEMA_DESC_ZH = `
请严格仅输出一个 JSON 对象，不要包含任何其他文字或 markdown 代码块。格式必须为：
{
  "risk_level": "high 或 medium 或 low 或 unknown",
  "confidence": 0-100 的整数,
  "risk_type": ["从以下选一个或多个：诈骗、黑灰产、钓鱼网站、投资骗局、兼职骗局、假客服、虚假医疗、老年人骗局、未知风险、诈骗网站、钓鱼诈骗、金融诈骗"],
  "summary": "一句话总结",
  "reasons": ["原因1", "原因2", "原因3"],
  "advice": ["建议1", "建议2", "建议3"]
}`;

const SCHEMA_DESC_EN = `
You must output exactly one JSON object, with no extra text or markdown. The format MUST be:
{
  "risk_level": "high or medium or low or unknown",
  "confidence": an integer between 0 and 100,
  "risk_type": ["one or more of: fraud, gray/black industry, phishing site, investment scam, part-time job scam, fake customer service, fake medical, elderly scam, unknown risk, scam website, phishing scam, financial scam"],
  "summary": "one-sentence summary",
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "advice": ["advice 1", "advice 2", "advice 3"]
}`;

@Injectable()
export class AiPromptsService {
  buildSystemPrompt(language: 'zh' | 'en'): string {
    const base = language === 'zh'
      ? '你是一个网络安全风险分析助手，专门用于识别诈骗、黑灰产、钓鱼网站等风险。你根据用户输入（文本、电话号、链接、公司名、截图描述等），分析是否存在诈骗、黑灰产、钓鱼等风险。'
      : 'You are a cybersecurity risk analysis assistant. Analyze user input (text, phone, link, company name, or screenshot description) for fraud, gray/black industry, phishing, etc. When the user writes in English, you MUST write all JSON string values (summary, reasons, advice) in English only.';
    return `${base}\n${language === 'zh' ? SCHEMA_DESC_ZH : SCHEMA_DESC_EN}`;
  }

  /** URL 专用：系统角色 + 同一 JSON schema */
  buildUrlSystemPrompt(language: 'zh' | 'en'): string {
    const role = language === 'zh'
      ? '您是一名网络安全助理。请严格仅输出一个 JSON 对象，不要包含任何其他文字或 markdown 代码块。'
      : 'You are a cybersecurity assistant. Output only a single JSON object, no other text or markdown. When the user message is in English, write all JSON string values (summary, reasons, advice) in English only.';
    return `${role}\n${language === 'zh' ? SCHEMA_DESC_ZH : SCHEMA_DESC_EN}`;
  }

  /**
   * URL 专用：命中时用「强信号」说明，未命中时用「未发现明显风险」说明。均要求生成 summary + reasons(3条) + advice(3条)。
   */
  buildUrlUserPrompt(
    content: string,
    url: string,
    urlResult: { risk_level: string; tags: string[]; records: any[] },
    language: 'zh' | 'en',
  ): string {
    const hit = urlResult.records && urlResult.records.length > 0;
    if (language === 'zh') {
      if (hit) {
        const level = urlResult.risk_level || 'high';
        const tagsStr = (urlResult.tags || []).length ? `，标签：${urlResult.tags.join('、')}` : '';
        const recordsBrief = urlResult.records.slice(0, 5).map((r: any) => `[${r.riskLevel}] ${(r.content || '').slice(0, 100)}`).join('；');
        return `这是曾经被标记为 ${level} 的 URL，以及用户原话。请解释其危险性以及用户应采取的措施。\n\nURL：${url}\n用户原话：${content}\n\n风险库命中：${level}${tagsStr}\n命中记录摘要：${recordsBrief}\n\n请按约定 JSON 输出（summary、reasons 三条、advice 三条）。`;
      }
      return `我们的风险数据库中未找到该网址。请你仅凭当前内容与一般安全知识给出判断，并说明依据。请分析该 URL 及用户原话，评估潜在风险。\n\n重要规则：请勿断言该网址 100% 安全；仅在适当情况下才表示未发现已知风险；解释可能存在的可疑模式。\n\nURL：${url}\n用户原话：${content}\n\n请按约定 JSON 输出（summary、reasons 三条、advice 三条）。`;
    }
    if (hit) {
      const level = urlResult.risk_level || 'high';
      return `This URL has been flagged as ${level}. User message: ${content}. Explain the risk and measures the user should take. Output JSON with summary, 3 reasons, 3 advice.`;
    }
    return `Our risk database has no record for this URL. Analyze the URL and user message for potential risks. Do not claim the URL is 100% safe; only state that no known risk was found when appropriate. Output JSON with summary, 3 reasons, 3 advice. URL: ${url}. User: ${content}.`;
  }

  buildUserPrompt(
    content: string,
    inputType: string,
    language: 'zh' | 'en',
    ragCases: KnowledgeCaseHit[],
    riskDbResult: string | null,
  ): string {
    const typeLabel = { text: '文本', phone: '电话', url: '链接', company: '公司/平台', screenshot: '截图' }[inputType] || inputType;
    let user = language === 'zh'
      ? `用户输入类型：${typeLabel}\n内容：\n${content}`
      : `Input type: ${inputType}\nContent:\n${content}`;
    if (riskDbResult) {
      const dbHint = language === 'zh'
        ? `\n风险库命中结果：${riskDbResult}（请结合该结果综合判断）`
        : `\nRisk DB result: ${riskDbResult} (consider in your analysis)`;
      user += dbHint;
    }
    if (ragCases.length > 0) {
      const ref = language === 'zh' ? '\n参考以下相似案例（仅作参考）：\n' : '\nReference cases:\n';
      const casesText = ragCases.map((c) => `[${c.title}] ${c.content.slice(0, 200)}...`).join('\n');
      user += ref + casesText;
    }
    if (language === 'en') {
      user += '\n\nImportant: Write summary, reasons, and advice in English only.';
    }
    return user;
  }
}
