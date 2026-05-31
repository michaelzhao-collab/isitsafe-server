/**
 * V4-P0 AI 分析评测样本服务
 *
 * 职责：
 *  - 每次 AI 调用末尾，异步采样写入 ai_evaluation_samples 表
 *  - 抽样率由环境变量 AI_EVAL_SAMPLE_RATE 控制（0.0 ~ 1.0，默认 1.0 全量）
 *  - 失败不影响主链路，全部 try/catch + logger.warn
 *  - 提供 admin 查询 / 评分 / 统计 接口的底层方法
 *
 * 不做：
 *  - 不参与 prompt 设计
 *  - 不参与决策
 *  - 不参与 iOS 渲染
 *
 * 数据安全：
 *  - input_content 可能包含用户隐私（号码 / 链接）→ 仅 admin 查看，注意 GDPR 兼容
 *  - prompt_snapshot 体积可能较大（~2KB / 条），全量采样需注意存储成本
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/** 一条采样的全部字段（除了 id 和 createdAt） */
export interface RecordSampleInput {
  conversationId?: string;
  userId?: string | null;
  inputContent: string;
  inputType: string;
  language: string;
  promptSnapshot: { system: string; user: string };
  aiRawResponse: string;
  parsedResult: any;
  intent?: string;
  intentVia?: string;
  promptVersion?: string;
  modelProvider: string;
  latencyMs: number;
  tokensUsed?: number | null;
}

/** admin 列表筛选 */
export interface ListSamplesQuery {
  promptVersion?: string;
  intent?: string;
  scored?: 'yes' | 'no' | 'all';
  page?: number;
  pageSize?: number;
}

/** 评分提交 */
export interface ScoreSampleInput {
  adminUserId: string;
  score: number; // 1-5
  label?: string;
  notes?: string;
}

@Injectable()
export class AiEvaluationService {
  private readonly logger = new Logger(AiEvaluationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /** 当前采样率：0.0 ~ 1.0，默认 1.0 */
  private get sampleRate(): number {
    const v = parseFloat(this.config.get('AI_EVAL_SAMPLE_RATE', '1') ?? '1');
    if (Number.isNaN(v)) return 1;
    return Math.max(0, Math.min(1, v));
  }

  /**
   * 异步写一条样本。失败仅 warn，不抛错。
   * 在 ai.service.analyze 末尾 / IntentResponseService.generate 末尾调用
   */
  async record(input: RecordSampleInput): Promise<void> {
    try {
      // 抽样
      if (this.sampleRate < 1 && Math.random() > this.sampleRate) return;

      // 截断超长字段防止 DB 写失败
      const trim = (s: string, max: number) =>
        s && s.length > max ? s.slice(0, max) : s ?? '';

      await this.prisma.aiEvaluationSample.create({
        data: {
          conversationId: input.conversationId ?? null,
          userId: input.userId ?? null,
          inputContent: trim(input.inputContent, 8000),
          inputType: input.inputType.slice(0, 20),
          language: input.language.slice(0, 10),
          promptSnapshot: {
            system: trim(input.promptSnapshot.system, 8000),
            user: trim(input.promptSnapshot.user, 8000),
          } as any,
          aiRawResponse: trim(input.aiRawResponse, 8000),
          parsedResult: input.parsedResult ?? {},
          intent: input.intent?.slice(0, 30) ?? null,
          intentVia: input.intentVia?.slice(0, 20) ?? null,
          promptVersion: (input.promptVersion ?? 'baseline').slice(0, 40),
          modelProvider: input.modelProvider.slice(0, 30),
          latencyMs: Math.max(0, Math.min(60_000, input.latencyMs | 0)),
          tokensUsed: input.tokensUsed ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`[AI_EVAL] 写入失败（不影响主链路）: ${err?.message ?? err}`);
    }
  }

  /**
   * Admin 列表：分页 + 筛选
   */
  async list(q: ListSamplesQuery) {
    const pageSize = Math.min(Math.max(q.pageSize ?? 20, 1), 100);
    const page = Math.max(q.page ?? 1, 1);
    const where: any = {};
    if (q.promptVersion) where.promptVersion = q.promptVersion;
    if (q.intent) where.intent = q.intent;
    if (q.scored === 'yes') where.adminScore = { not: null };
    else if (q.scored === 'no') where.adminScore = null;

    const [items, total] = await Promise.all([
      this.prisma.aiEvaluationSample.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.aiEvaluationSample.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 单条详情（含完整 prompt + raw） */
  async getById(id: string) {
    return this.prisma.aiEvaluationSample.findUnique({ where: { id } });
  }

  /**
   * 提交评分
   * - score 强制 1-5
   * - 同一条可重新评分（覆盖）
   */
  async score(id: string, input: ScoreSampleInput) {
    const score = Math.max(1, Math.min(5, input.score | 0));
    return this.prisma.aiEvaluationSample.update({
      where: { id },
      data: {
        adminScore: score,
        adminLabel: input.label?.slice(0, 200) ?? null,
        adminNotes: input.notes?.slice(0, 4000) ?? null,
        scoredByUserId: input.adminUserId,
        scoredAt: new Date(),
      },
    });
  }

  /**
   * 统计概览：按 promptVersion 分组的平均分 / 已标注数 / 总数
   * 用于 admin 页顶部"baseline / shadow / v1_cot" 对比卡
   */
  async statsByVersion() {
    // Prisma 不支持 groupBy + avg(int)，手动聚合
    const rows = await this.prisma.aiEvaluationSample.groupBy({
      by: ['promptVersion'],
      _count: { _all: true },
    });
    const result: Array<{
      promptVersion: string;
      total: number;
      scored: number;
      avgScore: number | null;
    }> = [];
    for (const r of rows) {
      const version = r.promptVersion;
      const scoredAgg = await this.prisma.aiEvaluationSample.aggregate({
        where: { promptVersion: version, adminScore: { not: null } },
        _count: { _all: true },
        _avg: { adminScore: true },
      });
      result.push({
        promptVersion: version,
        total: r._count._all,
        scored: scoredAgg._count._all,
        avgScore: scoredAgg._avg.adminScore ?? null,
      });
    }
    return result.sort((a, b) => b.total - a.total);
  }
}
