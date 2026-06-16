import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelSubmitDto, IntelPreferencesDto } from './dto/intel.dto';
import { AiProviderService } from '../ai/providers/ai-provider.service';

/**
 * V3-B 情报推送服务
 *
 * 设计要点：
 *  - 内容来源：管理员编辑发布（intel_alerts） + 用户上报（intel_submissions 审核后合并）
 *  - 用户 feed：联表 + 已读状态 + 按 region/audience 过滤
 *  - 未读数：仅算 region/audience 匹配的且 status=published 且未读
 *  - 阅读：deliveries 表 upsert 时 set read_at
 */
@Injectable()
export class IntelService {
  private readonly logger = new Logger(IntelService.name);

  constructor(
    private prisma: PrismaService,
    private aiProvider: AiProviderService,
  ) {}

  // ====================================================================
  // 用户侧
  // ====================================================================

  /**
   * 拉取用户 feed
   * 顺序：紧急 > 高 > 普通，按 published_at desc
   */
  async getFeed(params: {
    userId: string;
    region?: string;
    language?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit ?? 30, 100);
    const lang = params.language || 'zh';
    const region = params.region || '';

    // V4-P5：不再按 language 强过滤——抓到中文翻成英文 / 抓到英文翻成中文
    // 这样英语用户也能看到中文源的情报，反之亦然。原文 lang≠target 时
    // 联表 intelAlertI18n 取翻译，缺翻译则回退原文（不影响用户阅读）
    const candidates = await this.prisma.intelAlert.findMany({
      where: { status: 'published' },
      orderBy: [
        { severity: 'desc' },
        { publishedAt: 'desc' },
      ],
      take: limit * 2,
      include: {
        translations: {
          where: { language: lang },
          select: { title: true, summary: true, contentBlocks: true },
        },
      },
    });

    // 用户偏好（用于人群匹配）
    const pref = await this.prisma.userIntelPreferences.findUnique({
      where: { userId: params.userId },
    });
    const userAudiences: string[] = (pref?.categories as any) ?? [];

    // 按 region/audience 过滤（JSON 字段可能为 null / 非数组，需做防御）
    const filtered = candidates.filter((a) => {
      const regions: string[] = Array.isArray(a.targetRegions) ? (a.targetRegions as any) : [];
      const audiences: string[] = Array.isArray(a.targetAudiences) ? (a.targetAudiences as any) : [];
      // 空数组视为 "*"（向后兼容）
      const regionMatch = regions.length === 0
        || regions.includes('*')
        || (region && regions.some((r) => region.startsWith(r)));
      const audMatch =
        audiences.length === 0
        || audiences.includes('*')
        || userAudiences.length === 0
        || audiences.some((aud) => userAudiences.includes(aud));
      return regionMatch && audMatch;
    });

    // 严重度数字排序
    const sevPriority: Record<string, number> = { urgent: 0, high: 1, normal: 2 };
    filtered.sort((a, b) => {
      const da = sevPriority[a.severity] ?? 99;
      const db = sevPriority[b.severity] ?? 99;
      if (da !== db) return da - db;
      const ta = a.publishedAt?.getTime() ?? 0;
      const tb = b.publishedAt?.getTime() ?? 0;
      return tb - ta;
    });

    const items = filtered.slice(0, limit);

    // 已读状态
    const itemIds = items.map((i) => i.id);
    const readMap = new Map<string, Date | null>();
    if (itemIds.length > 0) {
      const deliveries = await this.prisma.intelDelivery.findMany({
        where: { userId: params.userId, intelId: { in: itemIds } },
        select: { intelId: true, readAt: true },
      });
      for (const d of deliveries) {
        readMap.set(d.intelId, d.readAt);
      }
    }

    return items.map((i) => {
      // V4-P5：用户语言跟原文不同 → 用翻译；翻译还没填好则回退原文
      const t = (i as any).translations?.[0];
      const useTranslation = i.language !== lang && t;
      return {
        id: i.id,
        title: useTranslation ? t.title : i.title,
        summary: useTranslation ? t.summary : i.summary,
        category: i.category,
        severity: i.severity,
        language: lang, // 告诉客户端"这是按你要的语言返回的"
        sourceUrl: i.sourceUrl,
        coverImage: (i as any).coverImage ?? null,
        publishedAt: i.publishedAt,
        isRead: readMap.has(i.id) ? readMap.get(i.id) != null : false,
      };
    });
  }

  async getDetail(userId: string, intelId: string) {
    // V4-P5：拉用户语言决定要不要翻译
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    const targetLang = (user?.language || 'zh').startsWith('en') ? 'en' : 'zh';

    const intel = await this.prisma.intelAlert.findUnique({
      where: { id: intelId },
      include: {
        translations: {
          where: { language: targetLang },
          select: { title: true, summary: true, contentBlocks: true },
        },
      },
    });
    if (!intel || intel.status !== 'published') {
      throw new NotFoundException('Intel not found');
    }

    // 标记已读（upsert delivery）
    await this.prisma.intelDelivery.upsert({
      where: { intelId_userId: { intelId, userId } },
      create: {
        intelId,
        userId,
        deliveredAt: new Date(),
        readAt: new Date(),
      },
      update: { readAt: new Date() },
    });

    // 用户语言跟原文不同 → 用翻译；缺翻译则原文（避免空白详情页）
    const t = (intel as any).translations?.[0];
    const useTranslation = intel.language !== targetLang && t;
    return {
      ...intel,
      title: useTranslation ? t.title : intel.title,
      summary: useTranslation ? t.summary : intel.summary,
      contentBlocks: useTranslation ? t.contentBlocks : intel.contentBlocks,
      language: targetLang,
      // 不返回 translations 数组，前端用不到
      translations: undefined,
    };
  }

  async getUnreadCount(userId: string, region?: string, language?: string): Promise<number> {
    // 简化：拿用户 feed 然后过滤未读，前端已能感知
    const feed = await this.getFeed({ userId, region, language, limit: 100 });
    return feed.filter((i) => !i.isRead).length;
  }

  /** Controller 入口：自动从 user 表读 regionCode / language，避免在 controller 直接访问 prisma */
  async getFeedForUser(userId: string, opts: { language?: string; limit?: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { regionCode: true, language: true },
    });
    return this.getFeed({
      userId,
      region: user?.regionCode ?? undefined,
      language: opts.language || user?.language || 'zh',
      limit: opts.limit ?? 30,
    });
  }

  async getUnreadCountForUser(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { regionCode: true, language: true },
    });
    return this.getUnreadCount(userId, user?.regionCode ?? undefined, user?.language || 'zh');
  }

  // ====================================================================
  // 上报
  // ====================================================================

  async submit(userId: string, dto: IntelSubmitDto) {
    return this.prisma.intelSubmission.create({
      data: {
        userId,
        category: dto.category,
        content: dto.content,
        attachments: (dto.attachments ?? []) as any,
        status: 'pending',
      },
    });
  }

  async getMySubmissions(userId: string, limit = 30) {
    return this.prisma.intelSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ====================================================================
  // 偏好
  // ====================================================================

  async updatePreferences(userId: string, dto: IntelPreferencesDto) {
    return this.prisma.userIntelPreferences.upsert({
      where: { userId },
      create: {
        userId,
        categories: (dto.categories ?? []) as any,
        pushFreq: dto.pushFreq ?? 'daily_1',
        pushTime: dto.pushTime,
      },
      update: {
        ...(dto.categories !== undefined && { categories: dto.categories as any }),
        ...(dto.pushFreq !== undefined && { pushFreq: dto.pushFreq }),
        ...(dto.pushTime !== undefined && { pushTime: dto.pushTime }),
      },
    });
  }

  async getPreferences(userId: string) {
    const pref = await this.prisma.userIntelPreferences.findUnique({ where: { userId } });
    return pref ?? {
      userId,
      categories: [],
      pushFreq: 'daily_1',
      pushTime: null,
      updatedAt: new Date(),
    };
  }

  // ====================================================================
  // 分类列表（client 用于偏好设置选项）
  // ====================================================================

  // ====================================================================
  // Admin 后台
  // ====================================================================

  async adminListAlerts(params: { status?: string; language?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 20));
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.language) where.language = params.language;
    const [items, total] = await Promise.all([
      this.prisma.intelAlert.findMany({
        where,
        // V4-P4 举报多的优先看到，便于审核
        orderBy: [{ reports: { _count: 'desc' } }, { status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { reports: true } } },
      }),
      this.prisma.intelAlert.count({ where }),
    ]);
    // 展平 _count.reports → reportCount，admin 列表更直观
    const mapped = items.map((i: any) => ({
      ...i,
      reportCount: i._count?.reports ?? 0,
      _count: undefined,
    }));
    return { items: mapped, total, page, pageSize };
  }

  /// V4-P4 用户举报一条情报
  async submitReport(userId: string, intelId: string, reason?: string, note?: string) {
    const allowed = ['spam', 'inaccurate', 'illegal', 'offensive', 'other'];
    const r = (reason ?? '').trim();
    if (!allowed.includes(r)) {
      throw new BadRequestException('Invalid reason');
    }
    // 必须是已发布的情报才能举报（防刷草稿）
    const intel = await this.prisma.intelAlert.findUnique({
      where: { id: intelId },
      select: { id: true, status: true },
    });
    if (!intel || intel.status !== 'published') {
      throw new NotFoundException('Intel not found');
    }
    const cleanNote = note?.trim().slice(0, 500) || null;
    await this.prisma.intelReport.upsert({
      where: { intelId_userId: { intelId, userId } },
      create: { intelId, userId, reason: r, note: cleanNote },
      update: { reason: r, note: cleanNote },
    });
    return { ok: true };
  }

  async adminCreateAlert(data: {
    title: string;
    summary: string;
    contentBlocks?: any;
    category: string;
    severity: 'normal' | 'high' | 'urgent';
    targetRegions: string[];
    targetAudiences: string[];
    language?: string;
    sourceUrl?: string;
    status?: 'draft' | 'pending' | 'published' | 'archived';
  }) {
    const status = data.status ?? 'draft';
    const publishedAt = status === 'published' ? new Date() : null;
    return this.prisma.intelAlert.create({
      data: {
        title: data.title,
        summary: data.summary,
        contentBlocks: data.contentBlocks ?? null,
        category: data.category,
        severity: data.severity,
        targetRegions: data.targetRegions as any,
        targetAudiences: data.targetAudiences as any,
        language: data.language ?? 'zh',
        sourceUrl: data.sourceUrl ?? null,
        status,
        publishedAt,
      },
    });
  }

  async adminUpdateAlert(id: string, data: Partial<{
    title: string;
    summary: string;
    contentBlocks: any;
    category: string;
    severity: 'normal' | 'high' | 'urgent';
    targetRegions: string[];
    targetAudiences: string[];
    language: string;
    sourceUrl: string | null;
    status: 'draft' | 'pending' | 'published' | 'archived';
  }>) {
    const current = await this.prisma.intelAlert.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Alert not found');
    const data2: any = { ...data };
    // 状态变 published 时设置 publishedAt
    if (data.status === 'published' && current.status !== 'published') {
      data2.publishedAt = new Date();
    } else if (data.status && data.status !== 'published') {
      data2.publishedAt = null;
    }
    return this.prisma.intelAlert.update({ where: { id }, data: data2 });
  }

  async adminDeleteAlert(id: string) {
    await this.prisma.intelAlert.delete({ where: { id } });
    return { success: true };
  }

  async adminListSubmissions(params: { status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 20));
    const where: any = {};
    if (params.status) where.status = params.status;
    const [items, total] = await Promise.all([
      this.prisma.intelSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.intelSubmission.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async adminReviewSubmission(id: string, action: 'approve' | 'reject' | 'merge', mergedToIntelId?: string) {
    const sub = await this.prisma.intelSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException();
    const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'merged';
    return this.prisma.intelSubmission.update({
      where: { id },
      data: {
        status,
        mergedToIntelId: action === 'merge' ? mergedToIntelId ?? null : null,
      },
    });
  }

  /**
   * S4-2 AI 改写：把原始草稿 → 结构化 summary + contentBlocks
   *
   * 返回 contentBlocks 格式：
   *   [{type:'step', text:'步骤1：...'}, {type:'step', ...}, {type:'tip', text:'防范建议1：...'}, ...]
   *
   * 前端拿到结果后由编辑者自行决定是否覆盖表单。
   */
  async adminAiRewrite(input: {
    title?: string;
    summary?: string;
    language: 'zh' | 'en';
  }): Promise<{
    summary: string;
    contentBlocks: Array<{ type: string; text: string }>;
    provider?: string;
  }> {
    const sys =
      input.language === 'en'
        ? `You are a scam-awareness editor. Given a raw note, produce:
1) A single-sentence summary (max 180 chars).
2) 3 "step" blocks describing how the scam unfolds.
3) 3 "tip" blocks with concrete defensive advice.
Return STRICT JSON: {"summary":"...","contentBlocks":[{"type":"step","text":"..."},{"type":"tip","text":"..."}]}.
Do not add any extra commentary.`
        : `你是反诈宣传编辑。把原始记录改写为：
1) 一句话概括（≤ 180 字）；
2) 3 个 step 块描述骗子套路；
3) 3 个 tip 块给出防范建议（动作具体可执行）。
严格返回 JSON：{"summary":"...","contentBlocks":[{"type":"step","text":"..."},{"type":"tip","text":"..."}]}。
不要任何额外说明。`;

    const user = JSON.stringify({
      title: input.title ?? '',
      summary: input.summary ?? '',
    });

    try {
      const result = await this.aiProvider.analyze(user, sys);
      // analyze 返回的 content 是字符串；尝试 JSON 解析
      const text = (result as any)?.content ?? (result as any)?.text ?? '';
      const parsed = this.safeJsonExtract(text);
      if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.contentBlocks)) {
        const blocks = (parsed.contentBlocks as any[])
          .filter((b) => b && typeof b.type === 'string' && typeof b.text === 'string')
          .slice(0, 12)
          .map((b) => ({ type: String(b.type).slice(0, 20), text: String(b.text).slice(0, 800) }));
        return {
          summary: String(parsed.summary).slice(0, 200),
          contentBlocks: blocks,
          provider: (result as any)?.provider,
        };
      }
      this.logger.warn(`[Intel.aiRewrite] AI 返回无法解析为 JSON, 原文: ${text.slice(0, 200)}`);
      return {
        summary: input.summary ?? '',
        contentBlocks: [],
        provider: (result as any)?.provider,
      };
    } catch (err: any) {
      this.logger.error(`[Intel.aiRewrite] failed: ${err?.message ?? err}`);
      return { summary: input.summary ?? '', contentBlocks: [] };
    }
  }

  /** 从模型自由文本里"抠出" JSON 块（容忍前后 markdown ```json fence） */
  private safeJsonExtract(text: string): any | null {
    if (!text) return null;
    // 尝试直接 parse
    try { return JSON.parse(text); } catch { /* fallthrough */ }
    // 找第一个 { ... } 块
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* nope */ }
    }
    return null;
  }

  getCategories(language: string = 'zh') {
    if (language === 'en') {
      return [
        { key: 'impersonation', name: 'Impersonation (police/medic/customer-service)' },
        { key: 'phishing', name: 'Phishing links / fake apps' },
        { key: 'investment', name: 'Investment / stock-tip scams' },
        { key: 'package', name: 'Package / delivery scams' },
        { key: 'job', name: 'Job / commission scams' },
        { key: 'elder', name: 'Elder-targeted scams' },
        { key: 'romance', name: 'Romance / dating scams' },
      ];
    }
    return [
      { key: 'impersonation', name: '冒充客服 / 公检法 / 医保' },
      { key: 'phishing', name: '钓鱼链接 / 假 App' },
      { key: 'investment', name: '荐股 / 投资理财' },
      { key: 'package', name: '快递 / 物流诈骗' },
      { key: 'job', name: '兼职刷单' },
      { key: 'elder', name: '老年人专题' },
      { key: 'romance', name: '杀猪盘 / 网恋' },
    ];
  }
}
