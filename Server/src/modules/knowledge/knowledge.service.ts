import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(private prisma: PrismaService) {}

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

  /** 批量导入：传入多行 { title, category, content, language? }，ID 由 Prisma 自动生成 */
  async bulkCreate(
    items: Array<{ title: string; category: string; content: string; language?: string }>,
    defaultLanguage: string = 'zh',
  ) {
    if (!items?.length) return { created: 0, ids: [] };
    const created = await this.prisma.knowledgeCase.createMany({
      data: items.map((row) => ({
        title: String(row.title ?? '').trim(),
        category: String(row.category ?? '').trim() || '未分类',
        content: String(row.content ?? '').trim(),
        language: (row.language && (row.language === 'en' ? 'en' : 'zh')) || (defaultLanguage === 'en' ? 'en' : 'zh'),
      })),
      skipDuplicates: false,
    });
    return { created: created.count, ids: [] };
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
