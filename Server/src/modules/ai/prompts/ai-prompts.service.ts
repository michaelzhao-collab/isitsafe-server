/**
 * AI 系统/用户 Prompt 构建
 * 强制 AI 只返回 JSON，严格符合 schema
 */
import { Injectable } from '@nestjs/common';
import { RISK_TYPES } from '../ai.types';
import type { KnowledgeCaseHit } from '../rag/rag-keyword.service';

const SCHEMA_DESC = `
请严格仅输出一个 JSON 对象，不要包含任何其他文字或 markdown 代码块。格式必须为：
{
  "risk_level": "high 或 medium 或 low 或 unknown",
  "confidence": 0-100 的整数,
  "risk_type": ["从以下选一个或多个：诈骗、黑灰产、钓鱼网站、投资骗局、兼职骗局、假客服、虚假医疗、老年人骗局、未知风险"],
  "summary": "一句话总结",
  "reasons": ["原因1", "原因2"],
  "advice": ["建议1", "建议2"]
}`;

@Injectable()
export class AiPromptsService {
  buildSystemPrompt(language: 'zh' | 'en'): string {
    const base = language === 'zh'
      ? '你是一个安全风险分析助手。根据用户输入（文本、电话号、链接、公司名、截图描述等），分析是否存在诈骗、黑灰产、钓鱼等风险。'
      : 'You are a safety risk analysis assistant. Analyze user input (text, phone, link, company name, or screenshot description) for fraud, gray/black industry, phishing, etc.';
    return `${base}\n${SCHEMA_DESC}`;
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
    return user;
  }
}
