/**
 * V3-K ContentFetchJob 调度服务
 *
 * 职责：
 *   - 创建 job 记录
 *   - 24h 限流：同 type + 同 admin 24h 内最多 3 次
 *   - setImmediate 异步执行 pipeline（fetch → rewrite → insert）
 *   - 每条 RawItem 入库为 2 条（zh + en），都标 source_fetch_job_id
 *   - intel 入 intel_alerts (status='draft')；knowledge 入 knowledge_cases (status='draft')
 *   - job 完成更新 totalFound / totalInserted / totalDuplicated / totalFailed / resultJson
 *
 * 注意：
 *   - 此 service 不依赖 HTTP 响应；setImmediate 让 controller 立即返回 jobId
 *   - 任何 step 异常都落 errorMessage，不抛
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FetcherService, RawItem } from './fetcher.service';
import { RewriterService, RewrittenItem } from './rewriter.service';
import type { SourceCategory } from './sources.config';

interface JobResultRecord {
  source: string;
  title: string;
  sourceUrl: string;
  status: 'inserted' | 'failed';
  errorMessage?: string;
}

// 24h 频次限流暂时关闭（值为 0 → 不检查）；保留"同类型 running 中禁止并发触发"
// 排障阶段先放开，后续稳定再加回（如改 3 / 10 / 50）
const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX_PER_WINDOW = 0;
const MAX_ITEMS_PER_JOB = 10;

@Injectable()
export class ContentFetchService {
  private readonly logger = new Logger(ContentFetchService.name);

  constructor(
    private prisma: PrismaService,
    private fetcher: FetcherService,
    private rewriter: RewriterService,
  ) {}

  /**
   * 触发抓取（admin 调）。立即返回 jobId，后台异步执行
   */
  async trigger(type: SourceCategory, adminUserId: string): Promise<{ jobId: string }> {
    // 24h 限流（RATE_LIMIT_MAX_PER_WINDOW=0 时跳过；排障阶段先关）
    if (RATE_LIMIT_MAX_PER_WINDOW > 0) {
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 3600 * 1000);
      const recent = await this.prisma.contentFetchJob.count({
        where: { type, triggeredBy: adminUserId, createdAt: { gte: since } },
      });
      if (recent >= RATE_LIMIT_MAX_PER_WINDOW) {
        throw new BadRequestException(
          `24h 内 ${type} 抓取已达上限 ${RATE_LIMIT_MAX_PER_WINDOW} 次，请稍后再试`,
        );
      }
    }
    // running 中也不重复触发
    const running = await this.prisma.contentFetchJob.findFirst({
      where: { type, status: { in: ['pending', 'running'] } },
    });
    if (running) {
      throw new BadRequestException(`已有 ${type} 抓取 job (${running.id}) 进行中，请等待完成`);
    }

    const job = await this.prisma.contentFetchJob.create({
      data: { type, status: 'pending', triggeredBy: adminUserId },
    });
    // 异步执行；setImmediate 让 controller 先返回
    setImmediate(() => {
      this.runJob(job.id, type).catch((e) => {
        this.logger.error(`[CF_JOB] ${job.id} 顶层 catch ${e?.message ?? e}`);
      });
    });
    return { jobId: job.id };
  }

  /** 查询单个 job（前端轮询用） */
  async getJob(jobId: string) {
    return this.prisma.contentFetchJob.findUnique({ where: { id: jobId } });
  }

  /**
   * 一键上架本批：把 job 抓取的所有 draft 条目改为 published
   * - intel：status='published' + publishedAt=now()
   * - knowledge：status='published'
   * 返回上架数量
   */
  async publishAllFromJob(jobId: string): Promise<{ intelPublished: number; knowledgePublished: number }> {
    const job = await this.prisma.contentFetchJob.findUnique({ where: { id: jobId } });
    if (!job) throw new BadRequestException('job 不存在');
    const now = new Date();
    const [intelRes, knowRes] = await Promise.all([
      this.prisma.intelAlert.updateMany({
        where: { sourceFetchJobId: jobId, status: 'draft' },
        data: { status: 'published', publishedAt: now },
      }),
      this.prisma.knowledgeCase.updateMany({
        where: { sourceFetchJobId: jobId, status: 'draft' },
        data: { status: 'published' },
      }),
    ]);
    return { intelPublished: intelRes.count, knowledgePublished: knowRes.count };
  }

  /** 列出最近 N 个 job（按 type 可选过滤） */
  async listJobs(opts: { type?: SourceCategory; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 10, 50);
    return this.prisma.contentFetchJob.findMany({
      where: opts.type ? { type: opts.type } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 核心 pipeline
   *   1. 标记 running
   *   2. fetch 拿原文（已去重 30 天）
   *   3. 截取最多 MAX_ITEMS_PER_JOB 条
   *   4. 逐条 rewrite + insert（失败的记 failed 不阻塞）
   *   5. 更新 job 完成统计
   */
  private async runJob(jobId: string, type: SourceCategory) {
    await this.prisma.contentFetchJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    });
    const startedAt = Date.now();
    const results: JobResultRecord[] = [];
    let totalDuplicated = 0;
    let totalFailed = 0;
    let totalInserted = 0;

    try {
      // 1. fetch（fetchAll 内部已做 30 天去重；同时返回各源诊断 + 去重统计）
      const fetchResult = await this.fetcher.fetchAll(type);
      let raws: RawItem[] = fetchResult.items;
      const sourceStats = fetchResult.sourceStats;
      totalDuplicated = fetchResult.duplicatedInDb;
      const totalFound = raws.length;

      // 2. 截顶
      if (raws.length > MAX_ITEMS_PER_JOB) raws = raws.slice(0, MAX_ITEMS_PER_JOB);

      // 3. 逐条 rewrite + insert
      for (const raw of raws) {
        try {
          const rewritten = await this.rewriter.rewrite(raw);
          await this.insertBilingual(type, jobId, raw, rewritten);
          totalInserted += 1;
          results.push({
            source: raw.sourceName,
            title: raw.title,
            sourceUrl: raw.sourceUrl,
            status: 'inserted',
          });
        } catch (err: any) {
          totalFailed += 1;
          this.logger.warn(`[CF_JOB] ${jobId} rewrite/insert fail (${raw.sourceUrl}): ${err?.message ?? err}`);
          results.push({
            source: raw.sourceName,
            title: raw.title,
            sourceUrl: raw.sourceUrl,
            status: 'failed',
            errorMessage: (err?.message ?? String(err)).slice(0, 500),
          });
        }
      }

      await this.prisma.contentFetchJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          finishedAt: new Date(),
          totalFound,
          totalInserted,
          totalDuplicated,
          totalFailed,
          // resultJson 同时带：每条候选的处理结果 + 各源诊断（admin 看"为啥 0 条"）
          resultJson: { items: results, sources: sourceStats } as any,
        },
      });
      this.logger.log(
        `[CF_JOB] ${jobId} done found=${totalFound} inserted=${totalInserted} failed=${totalFailed} in ${Math.round((Date.now() - startedAt) / 1000)}s`,
      );
    } catch (err: any) {
      this.logger.error(`[CF_JOB] ${jobId} FAILED: ${err?.message ?? err}`);
      await this.prisma.contentFetchJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: (err?.message ?? String(err)).slice(0, 1000),
          totalFound: 0,
          totalInserted,
          totalDuplicated,
          totalFailed,
          resultJson: { items: results, sources: [] } as any,
        },
      });
    }
  }

  /**
   * 1 条原文 → 入库 2 条记录（zh + en）
   */
  private async insertBilingual(
    type: SourceCategory,
    jobId: string,
    raw: RawItem,
    rewritten: RewrittenItem,
  ) {
    if (type === 'intel') {
      await this.prisma.intelAlert.createMany({
        data: [
          {
            title: rewritten.zh.title.slice(0, 200),
            summary: rewritten.zh.summary,
            contentBlocks: rewritten.zh.contentBlocks as any,
            category: rewritten.zh.category.slice(0, 64),
            severity: rewritten.zh.severity,
            targetRegions: ['*'] as any,
            targetAudiences: ['*'] as any,
            language: 'zh',
            sourceUrl: raw.sourceUrl.slice(0, 500),
            status: 'draft',
            sourceFetchJobId: jobId,
          },
          {
            title: rewritten.en.title.slice(0, 200),
            summary: rewritten.en.summary,
            contentBlocks: rewritten.en.contentBlocks as any,
            category: rewritten.en.category.slice(0, 64),
            severity: rewritten.en.severity,
            targetRegions: ['*'] as any,
            targetAudiences: ['*'] as any,
            language: 'en',
            sourceUrl: raw.sourceUrl.slice(0, 500),
            status: 'draft',
            sourceFetchJobId: jobId,
          },
        ],
      });
    } else {
      // knowledge
      const contentZh = this.blocksToPlainText(rewritten.zh.contentBlocks);
      const contentEn = this.blocksToPlainText(rewritten.en.contentBlocks);
      await this.prisma.knowledgeCase.createMany({
        data: [
          {
            title: rewritten.zh.title,
            category: rewritten.zh.category,
            content: contentZh.slice(0, 5000),
            contentBlocks: rewritten.zh.contentBlocks as any,
            tags: [rewritten.zh.category, rewritten.zh.severity] as any,
            language: 'zh',
            source: raw.sourceUrl,
            status: 'draft',
            sourceFetchJobId: jobId,
          },
          {
            title: rewritten.en.title,
            category: rewritten.en.category,
            content: contentEn.slice(0, 5000),
            contentBlocks: rewritten.en.contentBlocks as any,
            tags: [rewritten.en.category, rewritten.en.severity] as any,
            language: 'en',
            source: raw.sourceUrl,
            status: 'draft',
            sourceFetchJobId: jobId,
          },
        ],
      });
    }
  }

  private blocksToPlainText(blocks: Array<{ type: string; text: string }>): string {
    return blocks.map((b) => b.text).join('\n');
  }
}
