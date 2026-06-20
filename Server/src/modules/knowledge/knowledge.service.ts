import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 从 TipTap JSON 节点树递归提取纯文本，用于：
 * 1) 写入 content 字段供 RAG 关键词搜索使用
 * 2) 列表预览（截断）
 * 当 blocks 为 null/解析失败时返回空串，调用方应在此时保留入参 content。
 */
/**
 * 从 TipTap JSON 中提取第一张图片 src，找不到返回 null。
 * 用于列表缩略图回退（admin 没设封面时仍能展示文章首图）。
 */
function extractFirstImageFromBlocks(blocks: unknown): string | null {
  if (!blocks || typeof blocks !== 'object') return null;
  let found: string | null = null;
  const walk = (node: any) => {
    if (found || !node) return;
    if (node.type === 'image' && typeof node.attrs?.src === 'string' && node.attrs.src.length > 0) {
      found = node.attrs.src;
      return;
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
        if (found) return;
      }
    }
    if (Array.isArray(node)) {
      for (const child of node) {
        walk(child);
        if (found) return;
      }
    }
  };
  walk(blocks);
  return found;
}

function extractPlainTextFromBlocks(blocks: unknown): string {
  if (!blocks || typeof blocks !== 'object') return '';
  const parts: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (typeof node.text === 'string') {
      parts.push(node.text);
    }
    // 图片节点占位：保留 alt 文本但不会出现在搜索匹配中
    if (node.type === 'image' && node.attrs?.alt) {
      // 不把 alt 推入 parts，避免 alt 中的关键词污染搜索；如需收录可解开
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
    }
  };
  walk(blocks);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

@Injectable()
export class KnowledgeService {
  constructor(private prisma: PrismaService) {}

  private normalizeLanguage(input: string | undefined, fallback: 'zh' | 'en', title?: string, content?: string): 'zh' | 'en' {
    const raw = String(input ?? '').trim().toLowerCase();
    if (raw) {
      if (['zh', 'zh-cn', 'zh_hans', 'cn', '中文', '简体中文', 'chinese'].includes(raw)) return 'zh';
      if (['en', 'en-us', 'en-gb', '英文', '英语', 'english'].includes(raw)) return 'en';
    }
    const text = `${title ?? ''} ${content ?? ''}`;
    // 含中文字符则默认中文，否则英文
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    return fallback;
  }

  /**
   * 列表
   * - includeAllStatuses=true 时 admin 看所有；否则只看 status='published'（iOS 默认）
   */
  async list(
    category?: string,
    page = 1,
    pageSize = 20,
    search?: string,
    language = 'zh',
    opts: { includeAllStatuses?: boolean; status?: string; excludeReportedByUserId?: string | null } = {},
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = { language };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    // 默认仅 published；admin 传 includeAllStatuses 或 status 自己控制
    if (opts.status) {
      where.status = opts.status;
    } else if (!opts.includeAllStatuses) {
      where.status = 'published';
    }
    // V4 案例库举报隐藏：本人举报过的案例对本人不出现（admin 视角不受影响）
    if (opts.excludeReportedByUserId) {
      where.reports = { none: { userId: opts.excludeReportedByUserId } };
    }
    const [items, total] = await Promise.all([
      this.prisma.knowledgeCase.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.knowledgeCase.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getById(id: string, viewerUserId?: string | null) {
    const row = await this.prisma.knowledgeCase.findUnique({
      where: { id },
      ...(viewerUserId
        ? { include: { reports: { where: { userId: viewerUserId }, take: 1, select: { id: true } } } }
        : {}),
    });
    if (!row) throw new NotFoundException('Knowledge case not found');
    if (viewerUserId && (row as any).reports?.length) {
      throw new NotFoundException('Knowledge case not found');
    }
    return row;
  }

  /**
   * V2 列表：
   * - 剥掉 contentBlocks 大字段不返给客户端（列表无需渲染完整文章）
   * - 派生 hasContentBlocks（前端判断模式）
   * - 派生 firstImage（用于列表缩略图）：优先 coverImage，否则取 contentBlocks 中第一张图
   * 注意：仅供 V2 接口使用；老 /knowledge 路由继续返回完整字段以兼容旧客户端。
   */
  async listV2(
    category?: string,
    page = 1,
    pageSize = 20,
    search?: string,
    language = 'zh',
    opts: { excludeReportedByUserId?: string | null } = {},
  ) {
    const skip = (page - 1) * pageSize;
    // iOS V2 列表仅展示已上架内容（draft / archived 不可见）
    const where: any = { language, status: 'published' };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    // V4 案例库举报隐藏：本人视角下过滤掉自己举报过的
    if (opts.excludeReportedByUserId) {
      where.reports = { none: { userId: opts.excludeReportedByUserId } };
    }
    const [rows, total] = await Promise.all([
      this.prisma.knowledgeCase.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          content: true,
          tags: true,
          source: true,
          language: true,
          coverImage: true,
          contentBlocks: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.knowledgeCase.count({ where }),
    ]);
    const items = rows.map((row) => {
      const hasBlocks = !!row.contentBlocks;
      const firstImg = row.coverImage ?? extractFirstImageFromBlocks(row.contentBlocks);
      // 列表只回 content 摘要 + 派生字段，剥掉 contentBlocks 减小体积
      const { contentBlocks: _blocks, ...rest } = row;
      return {
        ...rest,
        hasContentBlocks: hasBlocks,
        firstImage: firstImg ?? null,
      };
    });
    return { items, total, page, pageSize };
  }

  /** V2 详情：附带 ETag 计算所需字段；服务端使用 id + updatedAt 派生 ETag */
  async getByIdV2(id: string, viewerUserId?: string | null) {
    const row = await this.prisma.knowledgeCase.findUnique({
      where: { id },
      ...(viewerUserId
        ? { include: { reports: { where: { userId: viewerUserId }, take: 1, select: { id: true } } } }
        : {}),
    });
    if (!row) throw new NotFoundException('Knowledge case not found');
    if (viewerUserId && (row as any).reports?.length) {
      throw new NotFoundException('Knowledge case not found');
    }
    return row;
  }

  /// V4 案例库举报（与 Intel 同语义：举报即终态、本人视角立刻隐藏）
  private readonly REPORT_DAILY_CAP = 20;
  async submitReport(userId: string, knowledgeId: string, reason?: string, note?: string) {
    const allowed = ['spam', 'inaccurate', 'illegal', 'offensive', 'other'];
    const r = (reason ?? '').trim();
    if (!allowed.includes(r)) {
      throw new BadRequestException('Invalid reason');
    }
    const row = await this.prisma.knowledgeCase.findUnique({
      where: { id: knowledgeId },
      select: { id: true, status: true },
    });
    if (!row || row.status !== 'published') {
      throw new NotFoundException('Knowledge case not found');
    }

    const existing = await this.prisma.knowledgeReport.findUnique({
      where: { knowledgeId_userId: { knowledgeId, userId } },
      select: { id: true },
    });
    if (existing) {
      return { ok: true, alreadyReported: true };
    }

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const recentCount = await this.prisma.knowledgeReport.count({
      where: { userId, createdAt: { gte: dayAgo } },
    });
    if (recentCount >= this.REPORT_DAILY_CAP) {
      throw new BadRequestException('Daily report limit reached');
    }

    const cleanNote = note?.trim().slice(0, 500) || null;
    await this.prisma.knowledgeReport.create({
      data: { knowledgeId, userId, reason: r, note: cleanNote },
    });
    return { ok: true };
  }

  async create(data: {
    title: string;
    content: string;
    category: string;
    tags?: string[];
    language?: string;
    source?: string;
    contentBlocks?: unknown | null;
    coverImage?: string | null;
  }) {
    // 优先用 contentBlocks 派生 content；空时回落 data.content
    const derivedContent = data.contentBlocks
      ? extractPlainTextFromBlocks(data.contentBlocks) || data.content
      : data.content;
    return this.prisma.knowledgeCase.create({
      data: {
        title: data.title,
        content: derivedContent,
        category: data.category,
        tags: (data.tags || []) as any,
        language: data.language || 'zh',
        source: data.source ?? null,
        ...(data.contentBlocks !== undefined && { contentBlocks: data.contentBlocks as any }),
        ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
      } as any,
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      content?: string;
      category?: string;
      tags?: string[];
      source?: string;
      contentBlocks?: unknown | null;
      coverImage?: string | null;
      /** V3-K：'published' | 'draft' | 'archived' — 批量上架/下架用 */
      status?: string;
    },
  ) {
    // 若同时传 content 和 contentBlocks，优先用 blocks 派生 content
    let nextContent = data.content;
    if (data.contentBlocks !== undefined && data.contentBlocks !== null) {
      const derived = extractPlainTextFromBlocks(data.contentBlocks);
      if (derived) nextContent = derived;
    }
    return this.prisma.knowledgeCase.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(nextContent && { content: nextContent }),
        ...(data.category && { category: data.category }),
        ...(data.tags && { tags: data.tags as any }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.contentBlocks !== undefined && { contentBlocks: data.contentBlocks as any }),
        ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
        ...(data.status && { status: data.status }),
      } as any,
    });
  }

  async delete(id: string) {
    return this.prisma.knowledgeCase.delete({ where: { id } });
  }

  async bulkDelete(ids: string[]) {
    const validIds = Array.from(new Set((ids || []).map((s) => String(s || '').trim()).filter(Boolean)));
    if (!validIds.length) return { deleted: 0 };
    const result = await this.prisma.knowledgeCase.deleteMany({
      where: { id: { in: validIds } },
    });
    return { deleted: result.count };
  }

  /** 批量导入：传入多行 { title, category, content, language? }，ID 由 Prisma 自动生成 */
  async bulkCreate(
    items: Array<{ title: string; category: string; content: string; language?: string }>,
    defaultLanguage: string = 'zh',
  ) {
    if (!items?.length) return { created: 0, ids: [] };
    const normalize = (v: string) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const categoryRows = await this.prisma.knowledgeCategoryConfig.findMany({
      select: { key: true, nameZh: true, nameEn: true },
    });
    const categoryMap = new Map<string, string>();
    for (const c of categoryRows) {
      categoryMap.set(normalize(c.key), c.key);
      categoryMap.set(normalize(c.nameZh), c.key);
      categoryMap.set(normalize(c.nameEn), c.key);
    }

    const unknownCategories = new Set<string>();
    const normalizedRows = items.map((row) => {
        const rawCategory = String(row.category ?? '').trim();
        const mappedCategory = categoryMap.get(normalize(rawCategory));
        if (rawCategory && !mappedCategory) unknownCategories.add(rawCategory);
        const title = String(row.title ?? '').trim();
        const content = String(row.content ?? '').trim();
        const lang = this.normalizeLanguage(
          row.language,
          defaultLanguage === 'en' ? 'en' : 'zh',
          title,
          content,
        );
        return {
          title,
          category: mappedCategory || rawCategory || '未分类',
          content,
          language: lang,
        };
      });

    const incomingTitles = Array.from(new Set(normalizedRows.map((r) => r.title).filter((t) => t.length > 0)));
    const existing = incomingTitles.length
      ? await this.prisma.knowledgeCase.findMany({
          where: { title: { in: incomingTitles } },
          select: { title: true },
        })
      : [];
    const existingTitleSet = new Set(existing.map((r) => r.title));
    const batchSeen = new Set<string>();
    const dataToCreate = normalizedRows.filter((row) => {
      if (!row.title) return false;
      if (existingTitleSet.has(row.title)) return false;
      if (batchSeen.has(row.title)) return false;
      batchSeen.add(row.title);
      return true;
    });

    const skippedByTitle = normalizedRows.length - dataToCreate.length;
    if (dataToCreate.length === 0) {
      return {
        created: 0,
        ids: [],
        skippedByTitle,
        unknownCategories: Array.from(unknownCategories),
      };
    }
    const created = await this.prisma.knowledgeCase.createMany({
      data: dataToCreate,
      skipDuplicates: false,
    });
    return {
      created: created.count,
      ids: [],
      skippedByTitle,
      unknownCategories: Array.from(unknownCategories),
    };
  }

  /** 客户端使用：根据语言获取启用中的分类列表 */
  async listCategories(language: 'zh' | 'en' = 'zh') {
    const rows = await this.prisma.knowledgeCategoryConfig.findMany({
      where: { status: 'active' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.key,
      name: language === 'en' ? row.nameEn : row.nameZh,
      status: row.status,
      sortOrder: row.sortOrder,
    }));
  }
}
