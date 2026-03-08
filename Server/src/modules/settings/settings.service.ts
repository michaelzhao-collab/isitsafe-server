/**
 * Settings：MVP 先读 .env；预留从 settings 表读取（/api/admin/settings 可改）
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export type AiProviderName = 'doubao' | 'openai' | 'other';

@Injectable()
export class SettingsService {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  /** 默认 AI 提供商：先 env，再 DB */
  async getDefaultProvider(): Promise<AiProviderName> {
    const env = this.config.get('AI_PROVIDER') as AiProviderName | undefined;
    if (env && ['doubao', 'openai', 'other'].includes(env)) return env;
    try {
      const row = await this.prisma.settings.findFirst();
      if (row?.defaultProvider) return row.defaultProvider as AiProviderName;
    } catch {}
    return 'doubao';
  }

  async getDoubaoKey(): Promise<string | null> {
    const env = this.config.get('DOUBAO_API_KEY');
    if (env) return env;
    try {
      const row = await this.prisma.settings.findFirst();
      return row?.doubaoKey ?? null;
    } catch {
      return null;
    }
  }

  async getOpenaiKey(): Promise<string | null> {
    const env = this.config.get('OPENAI_API_KEY');
    if (env) return env;
    try {
      const row = await this.prisma.settings.findFirst();
      return row?.openaiKey ?? null;
    } catch {
      return null;
    }
  }

  async getAiBaseUrl(): Promise<string | null> {
    const env = this.config.get('AI_BASE_URL');
    if (env) return env;
    try {
      const row = await this.prisma.settings.findFirst();
      return row?.aiBaseUrl ?? null;
    } catch {
      return null;
    }
  }

  /** Admin 获取当前配置（脱敏） */
  async getForAdmin(): Promise<{
    defaultProvider: string;
    hasDoubaoKey: boolean;
    hasOpenaiKey: boolean;
    aiBaseUrl: string | null;
    updatedAt: Date | null;
  }> {
    const row = await this.prisma.settings.findFirst();
    const envProvider = this.config.get('AI_PROVIDER');
    const envDoubao = this.config.get('DOUBAO_API_KEY');
    const envOpenai = this.config.get('OPENAI_API_KEY');
    const envBase = this.config.get('AI_BASE_URL');
    return {
      defaultProvider: row?.defaultProvider ?? envProvider ?? 'doubao',
      hasDoubaoKey: !!(row?.doubaoKey ?? envDoubao),
      hasOpenaiKey: !!(row?.openaiKey ?? envOpenai),
      aiBaseUrl: row?.aiBaseUrl ?? envBase ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  /** Superadmin 更新配置（预留） */
  async updateForAdmin(data: {
    defaultProvider?: string;
    doubaoKey?: string | null;
    openaiKey?: string | null;
    aiBaseUrl?: string | null;
  }) {
    let row = await this.prisma.settings.findFirst();
    if (!row) {
      row = await this.prisma.settings.create({
        data: {
          defaultProvider: data.defaultProvider ?? 'doubao',
          doubaoKey: data.doubaoKey ?? null,
          openaiKey: data.openaiKey ?? null,
          aiBaseUrl: data.aiBaseUrl ?? null,
        },
      });
    } else {
      row = await this.prisma.settings.update({
        where: { id: row.id },
        data: {
          defaultProvider: data.defaultProvider ?? undefined,
          doubaoKey: data.doubaoKey !== undefined ? data.doubaoKey : undefined,
          openaiKey: data.openaiKey !== undefined ? data.openaiKey : undefined,
          aiBaseUrl: data.aiBaseUrl !== undefined ? data.aiBaseUrl : undefined,
        },
      });
    }
    return row;
  }
}
