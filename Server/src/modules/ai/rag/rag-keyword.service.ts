/**
 * RAG 关键词检索：keywordExtract + searchKnowledgeCases
 * 使用 Postgres ILIKE（title/content）及 tags 包含，返回 top 3~5 条
 *
 * TODO: 未来升级为向量检索——在此目录新增 vector-search.service.ts，
 * 实现 embed(content) + 向量相似度检索，本接口保持为 keyword 实现，可配置切换。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface KnowledgeCaseHit {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  language: string;
  score: number;
}

@Injectable()
export class RagKeywordService {
  constructor(private prisma: PrismaService) {}

  /**
   * 简单关键词提取：按空格/标点切分，过滤过短，取前 10 个
   * TODO: 可接入分词或 NLP 提升效果
   */
  keywordExtract(content: string): string[] {
    if (!content?.trim()) return [];
    const raw = content.replace(/[\s,，。！？、；]+/g, ' ').trim().split(/\s+/);
    const words = raw.filter((w) => w.length >= 2).slice(0, 10);
    return [...new Set(words)];
  }

  /**
   * 关键词检索：title ILIKE %keyword%, content ILIKE %keyword%, tags 包含 keyword
   * 返回按命中次数/粗略分数排序的 topK 条（默认 5）
   */
  async searchKnowledgeCases(
    keywords: string[],
    topK = 5,
    language = 'zh',
  ): Promise<KnowledgeCaseHit[]> {
    if (keywords.length === 0) return [];

    const cases = await this.prisma.knowledgeCase.findMany({
      where: { language },
      take: topK * 3, // 多取一些再排序
    });

    const scored = cases.map((c) => {
      const tags = (c.tags as string[]) || [];
      let score = 0;
      const contentLower = (c.content || '').toLowerCase();
      const titleLower = (c.title || '').toLowerCase();
      for (const kw of keywords) {
        const k = kw.toLowerCase();
        if (titleLower.includes(k)) score += 3;
        if (contentLower.includes(k)) score += 2;
        if (tags.some((t) => t.toLowerCase().includes(k))) score += 2;
      }
      return { ...c, tags, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ id, title, category, content, tags, language, score }) => ({
        id,
        title,
        category,
        content: content.slice(0, 500),
        tags,
        language,
        score,
      }));
  }
}
