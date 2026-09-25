import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronTime } from 'cron';
import { PrismaService } from '../../prisma/prisma.service';
import { FamilyEventService } from './family-event.service';

const DEFAULT_DAILY_SCAM_CRON = '0 10 * * *';

/** DAILY_SCAM_CRON 配错不能拖垮整个服务：非法表达式回退默认值并告警 */
function resolveDailyScamCron(): string {
  const expr = process.env.DAILY_SCAM_CRON?.trim();
  if (!expr) return DEFAULT_DAILY_SCAM_CRON;
  try {
    // 语法合法但永远不会触发的表达式（如 '0 0 31 2 *'）会在 CronJob.start 时抛错拖垮启动，
    // 所以这里额外算一次下次执行时间。
    new CronTime(expr).sendAt();
    return expr;
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      `[DailyScam] invalid DAILY_SCAM_CRON "${expr}", falling back to "${DEFAULT_DAILY_SCAM_CRON}"`,
    );
    return DEFAULT_DAILY_SCAM_CRON;
  }
}

/**
 * V5.1 每日一骗（daily_scam）。
 *
 * 决策 #5：**人工确认才发**。运营在 admin"明日一骗"队列建候选并审核（approved），
 * cron 每日定时把当天到期且 approved 的候选以 daily_scam 卡片发进所有家庭群，发完置 sent。
 *
 * 时区：@Cron 表达式按服务器时区（Railway = UTC）。默认 '0 10 * * *' = 10:00 UTC ≈ 18:00 Asia/Shanghai。
 *       可用环境变量 DAILY_SCAM_CRON 覆盖。
 */
@Injectable()
export class DailyScamService {
  private readonly logger = new Logger(DailyScamService.name);

  constructor(
    private prisma: PrismaService,
    private familyEvent: FamilyEventService,
  ) {}

  // ====== admin 队列 CRUD ======

  async list(params: { status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(params.pageSize ?? 30, 100);
    const where = params.status ? { status: params.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.dailyScamCandidate.findMany({
        where,
        orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dailyScamCandidate.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async create(input: {
    title: string;
    summary: string;
    riskLevel?: string;
    refType?: string | null;
    refId?: string | null;
    deepLink?: string | null;
    scheduledDate: string; // yyyy-MM-dd
  }) {
    const date = this.parseDate(input.scheduledDate);
    if (!input.title?.trim() || !input.summary?.trim()) {
      throw new BadRequestException('title/summary required');
    }
    return this.prisma.dailyScamCandidate.create({
      data: {
        title: input.title.trim().slice(0, 200),
        summary: input.summary.trim(),
        riskLevel: input.riskLevel ?? 'high',
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        deepLink: input.deepLink ?? null,
        scheduledDate: date,
        status: 'pending',
      },
    });
  }

  async update(id: string, input: {
    title?: string;
    summary?: string;
    riskLevel?: string;
    deepLink?: string | null;
    scheduledDate?: string;
  }) {
    const row = await this.prisma.dailyScamCandidate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('candidate not found');
    if (row.status === 'sent') throw new BadRequestException('已发送的候选不可编辑');
    return this.prisma.dailyScamCandidate.update({
      where: { id },
      data: {
        title: input.title?.trim().slice(0, 200) ?? undefined,
        summary: input.summary?.trim() ?? undefined,
        riskLevel: input.riskLevel ?? undefined,
        deepLink: input.deepLink === undefined ? undefined : input.deepLink,
        scheduledDate: input.scheduledDate ? this.parseDate(input.scheduledDate) : undefined,
      },
    });
  }

  /** 审核：pending → approved | rejected。reviewer 记录 admin id */
  async review(id: string, action: 'approve' | 'reject', reviewerId: string) {
    const row = await this.prisma.dailyScamCandidate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('candidate not found');
    if (row.status === 'sent') throw new BadRequestException('已发送的候选不可再审');
    return this.prisma.dailyScamCandidate.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.dailyScamCandidate.deleteMany({ where: { id, status: { not: 'sent' } } });
    return { success: true };
  }

  // ====== 定时派发 ======

  @Cron(resolveDailyScamCron(), { name: 'daily-scam-dispatch' })
  async runDailyDispatch() {
    // 紧急回退开关同群聊：CHAT_ENABLED=false 时不派发
    if (process.env.CHAT_ENABLED === 'false') {
      this.logger.log('[DailyScam] skipped: CHAT_ENABLED=false');
      return;
    }
    const start = Date.now();
    try {
      const result = await this.dispatchDueCandidates();
      this.logger.log(
        `[DailyScam] dispatched candidates=${result.candidates} groups=${result.groups} in ${Date.now() - start}ms`,
      );
    } catch (err: any) {
      this.logger.error(`[DailyScam] dispatch failed: ${err?.message}`, err?.stack);
    }
  }

  /**
   * 派发所有"到期（scheduledDate <= 今天）且 approved"的候选到全部家庭群。
   * 每条候选发完置 sent，避免重复。admin 手动"立即发送"也走这里（单条）。
   */
  async dispatchDueCandidates(): Promise<{ candidates: number; groups: number }> {
    const today = this.todayUtcDate();
    const due = await this.prisma.dailyScamCandidate.findMany({
      where: { status: 'approved', scheduledDate: { lte: today } },
      orderBy: { scheduledDate: 'asc' },
    });
    let groupsTotal = 0;
    for (const cand of due) {
      groupsTotal += await this.sendCandidate(cand.id);
    }
    return { candidates: due.length, groups: groupsTotal };
  }

  /** 立即发送单条候选（admin 手动触发或 cron 内部调用）。返回实发群数 */
  async sendCandidate(id: string): Promise<number> {
    const cand = await this.prisma.dailyScamCandidate.findUnique({ where: { id } });
    if (!cand) throw new NotFoundException('candidate not found');
    if (cand.status === 'sent') return 0;
    if (cand.status !== 'approved') throw new BadRequestException('仅 approved 候选可发送');

    // 先原子占位再派发：cron 与 admin"立即发送"并发时只有一方拿到；
    // 派发中途进程重启也不会下轮重发（宁可漏发部分群，不重复刷群）
    const claimed = await this.prisma.dailyScamCandidate.updateMany({
      where: { id, status: 'approved' },
      data: { status: 'sent', sentAt: new Date() },
    });
    if (claimed.count === 0) return 0;

    const groups = await this.prisma.familyGroup.findMany({ select: { id: true } });
    let sent = 0;
    for (const g of groups) {
      try {
        await this.familyEvent.emit({
          groupId: g.id,
          cardType: 'daily_scam',
          actorUserId: null,
          riskLevel: cand.riskLevel,
          refType: cand.refType,
          refId: cand.refId,
          title: cand.title,
          summary: cand.summary,
          extra: cand.deepLink ? { deepLink: cand.deepLink } : undefined,
        });
        sent++;
      } catch (err: any) {
        this.logger.warn(`[DailyScam] emit to group ${g.id} failed: ${err?.message}`);
      }
    }
    await this.prisma.dailyScamCandidate.update({
      where: { id },
      data: { sentGroupCount: sent },
    });
    return sent;
  }

  // ====== helpers ======

  private parseDate(s: string): Date {
    // 期望 yyyy-MM-dd；存为当天 00:00 UTC
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s?.trim() ?? '');
    if (!m) throw new BadRequestException('scheduledDate must be yyyy-MM-dd');
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }

  private todayUtcDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
