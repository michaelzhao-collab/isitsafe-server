import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderService } from '../ai/providers/ai-provider.service';

/**
 * V4-P5 情报双语翻译 worker
 *
 * 业主需求：抓到中文情报翻成英文，抓到英文情报翻成中文，两端用户都能看完整 feed。
 *
 * 实现方式：cron 每 5 分钟扫一次「已发布但缺另一种语言翻译」的情报，
 * 调 AiProviderService 翻译 title + summary 后写入 IntelAlertI18n。
 * 单次最多 5 条，防止 AI 配额 + 接口 timeout。
 */
@Injectable()
export class IntelTranslationService {
  private readonly logger = new Logger(IntelTranslationService.name);
  private readonly BATCH = 5;

  constructor(
    private prisma: PrismaService,
    private ai: AiProviderService,
  ) {}

  /// 每 5 分钟扫一次；首次部署后让翻译尽快铺开
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'intel-translation' })
  async translatePending(): Promise<void> {
    try {
      const pending = await this.findPending(this.BATCH);
      if (pending.length === 0) return;
      this.logger.log(`[INTEL_TRANSLATION] picked ${pending.length} pending alerts`);

      for (const item of pending) {
        try {
          await this.translateOne(item);
        } catch (err: any) {
          // 单条失败不阻塞后续；下个 cron 还会再试
          this.logger.warn(
            `[INTEL_TRANSLATION_FAILED] id=${item.id} ${item.language}→${item.targetLanguage} ${err?.message ?? err}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error('[INTEL_TRANSLATION_CRON_FATAL]', err?.message ?? err);
    }
  }

  /**
   * 找已发布且缺目标语言翻译的情报。
   * 算法：对每条 published alert，目标语言 = 原文 zh 的需要 en，原文 en 的需要 zh；
   * 用 NOT EXISTS 排除已存翻译的；按 publishedAt desc 优先翻新情报。
   */
  private async findPending(limit: number) {
    return this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        language: string;
        targetLanguage: string;
        title: string;
        summary: string;
      }>
    >(`
      SELECT
        a.id,
        a.language,
        CASE WHEN a.language = 'zh' THEN 'en' ELSE 'zh' END AS "targetLanguage",
        a.title,
        a.summary
      FROM intel_alerts a
      WHERE a.status = 'published'
        AND a.language IN ('zh', 'en')
        AND NOT EXISTS (
          SELECT 1 FROM intel_alert_i18n t
          WHERE t.intel_id = a.id
            AND t.language = CASE WHEN a.language = 'zh' THEN 'en' ELSE 'zh' END
        )
      ORDER BY a.published_at DESC NULLS LAST
      LIMIT $1
    `, limit);
  }

  /// 翻译单条；调 AI → 解析 JSON → upsert i18n 表
  private async translateOne(item: {
    id: string;
    language: string;
    targetLanguage: string;
    title: string;
    summary: string;
  }) {
    const isToEnglish = item.targetLanguage === 'en';
    const systemPrompt = isToEnglish
      ? 'You translate Chinese anti-fraud intelligence to English. Keep meaning faithful. Return STRICT JSON only.'
      : '你是反诈情报的中英翻译助手。把英文译为简体中文，意思必须忠实于原文。仅输出严格 JSON。';

    const userPrompt = isToEnglish
      ? `Translate the following anti-fraud intel headline + summary from Chinese to English. Return JSON exactly: {"title": "...", "summary": "..."}.\n\ntitle: ${item.title}\nsummary: ${item.summary}`
      : `请把以下反诈情报的标题和摘要从英文翻译成简体中文。严格返回 JSON：{"title": "...", "summary": "..."}\n\ntitle: ${item.title}\nsummary: ${item.summary}`;

    const res = await this.ai.analyze(userPrompt, systemPrompt);
    const parsed = this.parseJson(res.raw);
    if (!parsed || !parsed.title || !parsed.summary) {
      throw new Error(`Bad AI output (no title/summary in JSON): ${res.raw.slice(0, 200)}`);
    }

    await this.prisma.intelAlertI18n.upsert({
      where: { intelId_language: { intelId: item.id, language: item.targetLanguage } },
      create: {
        intelId: item.id,
        language: item.targetLanguage,
        title: String(parsed.title).slice(0, 500),
        summary: String(parsed.summary).slice(0, 2000),
        // 第一版只翻 title+summary，body 留原文（contentBlocks 字段不写）
      },
      update: {
        title: String(parsed.title).slice(0, 500),
        summary: String(parsed.summary).slice(0, 2000),
      },
    });
    this.logger.log(`[INTEL_TRANSLATION_OK] id=${item.id} ${item.language}→${item.targetLanguage}`);
  }

  /// AI 返回的 raw 可能带 ```json 包装或前后文，做容错解析
  private parseJson(raw: string): { title?: string; summary?: string } | null {
    if (!raw) return null;
    // 去 markdown code fence
    const cleaned = raw
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // 截取第一个 { 到最后一个 } 之间
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}
