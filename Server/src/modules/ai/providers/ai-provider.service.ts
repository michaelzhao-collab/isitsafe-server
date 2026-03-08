/**
 * AI Provider：doubao / openai / other(预留)
 * Key 优先从 .env，预留从 settings 表读取
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SettingsService, AiProviderName } from '../../settings/settings.service';

export interface AiCallResult {
  raw: string;
  provider: string;
  model: string | null;
  tokens: number | null;
  latencyMs: number;
}

@Injectable()
export class AiProviderService {
  constructor(
    private config: ConfigService,
    private settings: SettingsService,
  ) {}

  async getDefaultProvider(): Promise<AiProviderName> {
    return this.settings.getDefaultProvider();
  }

  private async getDoubaoConfig() {
    const key = await this.settings.getDoubaoKey() ?? this.config.get('DOUBAO_API_KEY');
    const baseUrl = await this.settings.getAiBaseUrl() ?? this.config.get('DOUBAO_API_URL', 'https://ark.cn-beijing.volces.com/api/v3');
    return { apiKey: key, baseUrl };
  }

  private async getOpenAIConfig() {
    const key = await this.settings.getOpenaiKey() ?? this.config.get('OPENAI_API_KEY');
    const baseUrl = await this.settings.getAiBaseUrl() ?? this.config.get('OPENAI_API_URL', 'https://api.openai.com/v1');
    return { apiKey: key, baseUrl };
  }

  async analyzeWithDoubao(prompt: string, systemPrompt: string): Promise<AiCallResult> {
    const { apiKey, baseUrl } = await this.getDoubaoConfig();
    if (!apiKey) throw new Error('DOUBAO_API_KEY not configured');
    const start = Date.now();
    const res = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: this.config.get('DOUBAO_MODEL', 'doubao-pro-32k'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      },
    );
    const content = res.data?.choices?.[0]?.message?.content;
    const usage = res.data?.usage;
    if (!content) throw new Error('Invalid Doubao response');
    return {
      raw: content,
      provider: 'doubao',
      model: res.data?.model ?? 'doubao-pro',
      tokens: usage?.total_tokens ?? null,
      latencyMs: Date.now() - start,
    };
  }

  async analyzeWithOpenAI(prompt: string, systemPrompt: string): Promise<AiCallResult> {
    const { apiKey, baseUrl } = await this.getOpenAIConfig();
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    const start = Date.now();
    const res = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: this.config.get('OPENAI_MODEL', 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      },
    );
    const content = res.data?.choices?.[0]?.message?.content;
    const usage = res.data?.usage;
    if (!content) throw new Error('Invalid OpenAI response');
    return {
      raw: content,
      provider: 'openai',
      model: res.data?.model ?? 'gpt-4o-mini',
      tokens: usage?.total_tokens ?? null,
      latencyMs: Date.now() - start,
    };
  }

  /** other 预留：可接入其他模型 */
  async analyzeWithOther(_prompt: string, _systemPrompt: string): Promise<AiCallResult> {
    throw new Error('AI provider "other" not implemented yet');
  }

  async analyze(
    prompt: string,
    systemPrompt: string,
    provider?: AiProviderName,
  ): Promise<AiCallResult> {
    const p = provider ?? (await this.getDefaultProvider());
    if (p === 'openai') return this.analyzeWithOpenAI(prompt, systemPrompt);
    if (p === 'other') return this.analyzeWithOther(prompt, systemPrompt);
    return this.analyzeWithDoubao(prompt, systemPrompt);
  }
}
