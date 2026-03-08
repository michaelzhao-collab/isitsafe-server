/**
 * Risk Database Check：按 type + content 精确查询 risk_data 表
 * 供 AI 模块在调用前做数据库检查，并将结果传入 Prompt 与 Score
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RiskCheckResult } from './risk.types';

@Injectable()
export class RiskService {
  constructor(private prisma: PrismaService) {}

  /**
   * 查询 risk_data：type = inputType AND content = content（精确匹配）
   * 返回命中记录的 risk_level、risk_category
   */
  async checkRisk(inputType: string, content: string): Promise<RiskCheckResult | null> {
    if (!content?.trim()) return null;
    const row = await this.prisma.riskData.findFirst({
      where: {
        type: inputType,
        content: content.trim(),
      },
      select: { riskLevel: true, riskCategory: true },
    });
    if (!row) return null;
    return {
      risk_level: row.riskLevel,
      risk_category: row.riskCategory,
    };
  }
}
