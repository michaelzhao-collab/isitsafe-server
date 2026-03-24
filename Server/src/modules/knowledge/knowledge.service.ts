import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  async list(category?: string, page = 1, pageSize = 20, search?: string, language = 'zh') {
    const skip = (page - 1) * pageSize;
    const where: any = { language };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
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

  async getById(id: string) {
    return this.prisma.knowledgeCase.findUniqueOrThrow({ where: { id } });
  }

  async create(data: {
    title: string;
    content: string;
    category: string;
    tags?: string[];
    language?: string;
    source?: string;
  }) {
    return this.prisma.knowledgeCase.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        tags: (data.tags || []) as any,
        language: data.language || 'zh',
        source: data.source ?? null,
      },
    });
  }

  async update(
    id: string,
    data: { title?: string; content?: string; category?: string; tags?: string[]; source?: string },
  ) {
    return this.prisma.knowledgeCase.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.content && { content: data.content }),
        ...(data.category && { category: data.category }),
        ...(data.tags && { tags: data.tags as any }),
        ...(data.source !== undefined && { source: data.source }),
      },
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
