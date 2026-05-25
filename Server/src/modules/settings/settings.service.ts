/**
 * Settings：MVP 先读 .env；预留从 settings 表读取（/api/admin/settings 可改）
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export type AiProviderName = 'doubao' | 'deepseek' | 'openai' | 'other';

const VALID_PROVIDERS: AiProviderName[] = ['doubao', 'deepseek', 'openai', 'other'];

@Injectable()
export class SettingsService {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  /** 默认 AI 提供商：先 env，再 DB */
  async getDefaultProvider(): Promise<AiProviderName> {
    const env = this.config.get('AI_PROVIDER') as AiProviderName | undefined;
    if (env && VALID_PROVIDERS.includes(env)) return env;
    try {
      const row = await this.prisma.settings.findFirst();
      const p = row?.defaultProvider as AiProviderName | undefined;
      if (p && VALID_PROVIDERS.includes(p)) return p;
    } catch {}
    return 'doubao';
  }

  /** 备用 AI 提供商：主 provider 失败时切换；null 表示不切换 */
  async getFallbackProvider(): Promise<AiProviderName | null> {
    const env = this.config.get('AI_FALLBACK_PROVIDER') as AiProviderName | undefined;
    if (env && VALID_PROVIDERS.includes(env)) return env;
    try {
      const row = await this.prisma.settings.findFirst();
      const p = (row as any)?.fallbackProvider as AiProviderName | undefined;
      if (p && VALID_PROVIDERS.includes(p)) return p;
    } catch {}
    // 默认无备用，避免在未配置 deepseek key 时产生误失败转移
    return null;
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

  async getDeepseekKey(): Promise<string | null> {
    const env = this.config.get('DEEPSEEK_API_KEY');
    if (env) return env;
    try {
      const row = await this.prisma.settings.findFirst();
      return (row as any)?.deepseekKey ?? null;
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
    fallbackProvider: string | null;
    hasDoubaoKey: boolean;
    hasDeepseekKey: boolean;
    hasOpenaiKey: boolean;
    aiBaseUrl: string | null;
    updatedAt: Date | null;
  }> {
    const row = await this.prisma.settings.findFirst();
    const envProvider = this.config.get('AI_PROVIDER');
    const envFallback = this.config.get('AI_FALLBACK_PROVIDER');
    const envDoubao = this.config.get('DOUBAO_API_KEY');
    const envDeepseek = this.config.get('DEEPSEEK_API_KEY');
    const envOpenai = this.config.get('OPENAI_API_KEY');
    const envBase = this.config.get('AI_BASE_URL');
    return {
      defaultProvider: row?.defaultProvider ?? envProvider ?? 'doubao',
      fallbackProvider: (row as any)?.fallbackProvider ?? envFallback ?? null,
      hasDoubaoKey: !!(row?.doubaoKey ?? envDoubao),
      hasDeepseekKey: !!((row as any)?.deepseekKey ?? envDeepseek),
      hasOpenaiKey: !!(row?.openaiKey ?? envOpenai),
      aiBaseUrl: row?.aiBaseUrl ?? envBase ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  /** Superadmin 更新配置（预留） */
  async updateForAdmin(data: {
    defaultProvider?: string;
    fallbackProvider?: string | null;
    doubaoKey?: string | null;
    deepseekKey?: string | null;
    openaiKey?: string | null;
    aiBaseUrl?: string | null;
  }) {
    if (data.defaultProvider && !VALID_PROVIDERS.includes(data.defaultProvider as AiProviderName)) {
      throw new Error(`defaultProvider must be one of: ${VALID_PROVIDERS.join(', ')}`);
    }
    if (
      data.fallbackProvider &&
      !VALID_PROVIDERS.includes(data.fallbackProvider as AiProviderName)
    ) {
      throw new Error(`fallbackProvider must be one of: ${VALID_PROVIDERS.join(', ')}`);
    }
    let row = await this.prisma.settings.findFirst();
    if (!row) {
      row = await this.prisma.settings.create({
        data: {
          defaultProvider: data.defaultProvider ?? 'doubao',
          fallbackProvider: data.fallbackProvider ?? null,
          doubaoKey: data.doubaoKey ?? null,
          deepseekKey: data.deepseekKey ?? null,
          openaiKey: data.openaiKey ?? null,
          aiBaseUrl: data.aiBaseUrl ?? null,
        } as any,
      });
    } else {
      row = await this.prisma.settings.update({
        where: { id: row.id },
        data: {
          defaultProvider: data.defaultProvider ?? undefined,
          fallbackProvider:
            data.fallbackProvider !== undefined ? data.fallbackProvider : undefined,
          doubaoKey: data.doubaoKey !== undefined ? data.doubaoKey : undefined,
          deepseekKey: data.deepseekKey !== undefined ? data.deepseekKey : undefined,
          openaiKey: data.openaiKey !== undefined ? data.openaiKey : undefined,
          aiBaseUrl: data.aiBaseUrl !== undefined ? data.aiBaseUrl : undefined,
        } as any,
      });
    }
    return row;
  }
}
