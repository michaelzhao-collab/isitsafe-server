/**
 * Risk DB Check：在 risk_data 中按 type + content 匹配
 * 用于 AI 前的预检与 Score 中的 DB_score
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { normalizeContent } from '../../../common/utils/normalize';

export interface RiskDataHit {
  id: string;
  type: string;
  content: string;
  riskLevel: string;
  riskCategory: string | null;
  tags: unknown;
}

@Injectable()
export class RiskDbService {
  constructor(private prisma: PrismaService) {}

  /**
   * 按类型与内容匹配 risk_data（内容做标准化后包含匹配或相等）
   */
  async check(
    type: string,
    normalizedContent: string,
    originalContent: string,
  ): Promise<RiskDataHit | null> {
    const list = await this.prisma.riskData.findMany({
      where: { type },
      take: 50,
    });
    const norm = normalizedContent.toLowerCase();
    const orig = originalContent.trim().toLowerCase();
    for (const r of list) {
      const rNorm = normalizeContent(r.content).toLowerCase();
      const rOrig = r.content.trim().toLowerCase();
      if (norm.includes(rNorm) || rNorm.includes(norm) || orig.includes(rOrig) || rOrig.includes(orig)) {
        return {
          id: r.id,
          type: r.type,
          content: r.content,
          riskLevel: r.riskLevel,
          riskCategory: r.riskCategory,
          tags: r.tags,
        };
      }
    }
    return null;
  }
}
