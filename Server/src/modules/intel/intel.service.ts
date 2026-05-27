import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntelSubmitDto, IntelPreferencesDto } from './dto/intel.dto';

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
  constructor(private prisma: PrismaService) {}

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

    // 加载已发布情报；region/audience 过滤在 service 层（Prisma JSON 操作有限）
    const candidates = await this.prisma.intelAlert.findMany({
      where: {
        status: 'published',
        language: lang,
      },
      orderBy: [
        { severity: 'desc' }, // urgent > high > normal（字符串顺序：urgent > normal > high 不对，service 层修正）
        { publishedAt: 'desc' },
      ],
      take: limit * 2, // 多拉一些供过滤
    });

    // 用户偏好（用于人群匹配）
    const pref = await this.prisma.userIntelPreferences.findUnique({
      where: { userId: params.userId },
    });
    const userAudiences: string[] = (pref?.categories as any) ?? [];

    // 按 region/audience 过滤
    const filtered = candidates.filter((a) => {
      const regions = (a.targetRegions as any) as string[];
      const audiences = (a.targetAudiences as any) as string[];
      const regionMatch = regions.includes('*')
        || (region && regions.some((r) => region.startsWith(r)));
      const audMatch =
        audiences.includes('*')
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

    return items.map((i) => ({
      id: i.id,
      title: i.title,
      summary: i.summary,
      category: i.category,
      severity: i.severity,
      language: i.language,
      sourceUrl: i.sourceUrl,
      publishedAt: i.publishedAt,
      isRead: readMap.has(i.id) ? readMap.get(i.id) != null : false,
    }));
  }

  async getDetail(userId: string, intelId: string) {
    const intel = await this.prisma.intelAlert.findUnique({
      where: { id: intelId },
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

    return intel;
  }

  async getUnreadCount(userId: string, region?: string, language?: string): Promise<number> {
    // 简化：拿用户 feed 然后过滤未读，前端已能感知
    const feed = await this.getFeed({ userId, region, language, limit: 100 });
    return feed.filter((i) => !i.isRead).length;
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
