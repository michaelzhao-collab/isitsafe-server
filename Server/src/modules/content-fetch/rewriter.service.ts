/**
 * V3-K AI 改写 / 翻译服务
 *
 * 输入：1 条 RawItem（含原文 title + summary + sourceUrl）
 * 输出：{ zh, en } 双语结构化结果
 *
 * 实现：单次 DeepSeek 调用让模型同时输出双语 JSON，保证术语一致；
 * 不分次翻译，避免风格漂移和事实丢失。
 *
 * 质量保证 prompt 中强调：
 *   - 改写而非直译（中文必须有中文新闻调性，英文用美式主流媒体风格）
 *   - 关键事实双语一致（金额/受害人画像/手段步骤）
 *   - category 严格从白名单选
 *   - contentBlocks 必须有 3 个 step + 1 个 tip
 *
 * 强制 JSON 输出 + safeJsonParse 容错。
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../ai/providers/ai-provider.service';
import type { RawItem } from './fetcher.service';

export interface RewrittenItem {
  zh: BilingualAlert;
  en: BilingualAlert;
}

export interface BilingualAlert {
  title: string;
  summary: string;
  contentBlocks: Array<{ type: 'step' | 'tip'; text: string }>;
  category: string;
  severity: 'urgent' | 'high' | 'normal';
}

const CATEGORY_WHITELIST = [
  'impersonation',
  'phishing',
  'investment',
  'package',
  'part_time',
  'loan',
  'elder_scam',
  'ai_fraud',
  'tech_support',
  'qr_fraud',
  'romance_scam',
] as const;

@Injectable()
export class RewriterService {
  private readonly logger = new Logger(RewriterService.name);

  constructor(private aiProvider: AiProviderService) {}

  /**
   * 单条原文 → 双语结构化
   *
   * 失败抛错，让上层 JobService 把这条记为 failed 并继续其他条目
   */
  async rewrite(item: RawItem): Promise<RewrittenItem> {
    const system = this.buildSystemPrompt();
    const user = this.buildUserPrompt(item);
    // 用 DeepSeek（按需要可走 settings 选择 provider；此处默认 deepseek）
    const ai = await this.aiProvider.analyze(user, system, 'deepseek');
    const parsed = this.safeJsonParse(ai?.raw ?? '');
    this.validate(parsed);
    return parsed;
  }

  private buildSystemPrompt(): string {
    return `你是反诈情报编辑兼专业中英翻译。任务：把一条原始反诈新闻/警示，改写为结构化双语条目。

严格按以下 JSON 输出，禁止 markdown 围栏，禁止额外文字：
{
  "zh": {
    "title": "中文标题（≤30 字，简洁含信息密度）",
    "summary": "中文摘要（≤200 字，反诈中心新闻稿调性，含时间/地点/金额/手段等关键事实）",
    "contentBlocks": [
      { "type": "step", "text": "第 1 步：..." },
      { "type": "step", "text": "第 2 步：..." },
      { "type": "step", "text": "第 3 步：..." },
      { "type": "tip", "text": "防范建议：..." }
    ],
    "category": "<白名单之一>",
    "severity": "urgent | high | normal"
  },
  "en": {
    "title": "English title (≤ 12 words, factual, news-style)",
    "summary": "English summary (≤ 80 words, mainstream-media tone, same facts as zh)",
    "contentBlocks": [
      { "type": "step", "text": "Step 1: ..." },
      { "type": "step", "text": "Step 2: ..." },
      { "type": "step", "text": "Step 3: ..." },
      { "type": "tip", "text": "How to protect yourself: ..." }
    ],
    "category": "<same as zh>",
    "severity": "<same as zh>"
  }
}

规则：
- 中文和英文必须基于同一事实，不允许事实漂移；金额/姓名/地名/时间双语一致
- category 严格从白名单选（重要！）：${CATEGORY_WHITELIST.join(' | ')}
- severity 严格三选一：urgent | high | normal
- 一定要有 3 个 step + 至少 1 个 tip
- 翻译质量要求：
  * 中文：反诈中心 / 公安部新闻稿调性，简洁有力，不要把英文直译成机翻味
  * 英文：FTC / AP / Reuters 调性，主动语态，避免中式英语
- 如果原文信息不足以构成 3 步，根据常识推断完整套路（不要编造金额/姓名）
- summary 必须把"为什么是诈骗、识别要点"讲清，给非专业读者也能看懂`;
  }

  private buildUserPrompt(item: RawItem): string {
    return `请处理以下原始内容：

来源：${item.sourceName} (${item.sourceLanguage})
标题：${item.title}
正文/摘要：${item.summary ?? '（仅有标题）'}
原链接：${item.sourceUrl}

输出双语 JSON。`;
  }

  private safeJsonParse(text: string): RewrittenItem {
    const stripped = text.replace(/```json\s?/gi, '').replace(/```\s?/g, '').trim();
    try {
      return JSON.parse(stripped) as RewrittenItem;
    } catch {
      const m = stripped.match(/\{[\s\S]*\}/);
      if (m) {
        return JSON.parse(m[0]) as RewrittenItem;
      }
      throw new Error('Rewriter: AI 返回无法解析为 JSON');
    }
  }

  private validate(r: RewrittenItem): void {
    for (const lang of ['zh', 'en'] as const) {
      const part = r?.[lang];
      if (!part) throw new Error(`Rewriter: 缺失 ${lang} 段`);
      if (!part.title || part.title.length === 0) throw new Error(`Rewriter: ${lang}.title 空`);
      if (!part.summary || part.summary.length === 0) throw new Error(`Rewriter: ${lang}.summary 空`);
      if (!Array.isArray(part.contentBlocks) || part.contentBlocks.length < 2) {
        throw new Error(`Rewriter: ${lang}.contentBlocks 至少 2 条`);
      }
      if (!CATEGORY_WHITELIST.includes(part.category as any)) {
        // 兜底为 'phishing' 而非直接 throw，避免一处分类错误导致整条丢失
        this.logger.warn(`Rewriter: ${lang}.category 不在白名单 (${part.category})，回落 'phishing'`);
        part.category = 'phishing';
      }
      if (!['urgent', 'high', 'normal'].includes(part.severity)) {
        part.severity = 'normal' as any;
      }
    }
  }
}
