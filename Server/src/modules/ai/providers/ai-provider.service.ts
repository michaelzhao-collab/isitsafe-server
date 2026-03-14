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
    const model = this.config.get('DOUBAO_MODEL', 'doubao-seed-2-0-pro-260215');
    // 官方文档：使用 /api/v3/responses，请求体为 model + input（input 为消息数组，content 可为 input_text 数组）
    const fullText = `${systemPrompt}\n\n${prompt}`;
    const body = {
      model,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: fullText }],
        },
      ],
    };
    const requestUrl = `${baseUrl}/responses`;
    console.log('[DOUBAO] REQUEST URL=' + requestUrl + ' model=' + model + ' systemPromptLen=' + systemPrompt.length + ' userPromptLen=' + prompt.length);
    console.log('[DOUBAO] ========== 提交给豆包的完整内容（未解析） ==========');
    console.log('[DOUBAO] SYSTEM_PROMPT_FULL:\n' + systemPrompt);
    console.log('[DOUBAO] USER_PROMPT_FULL:\n' + prompt);
    console.log('[DOUBAO] ========== 以上为提交内容结束 ==========');
    const start = Date.now();
    const res = await axios.post(requestUrl, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000,
    });
    const latencyMs = Date.now() - start;
    try {
      console.log('[DOUBAO] API_RESPONSE_RAW_BODY (接口原始 JSON):\n' + JSON.stringify(res.data, null, 2));
    } catch (_) {}
    const content = this.extractDoubaoResponseContent(res.data);
    const usage = res.data?.usage ?? res.data?.output?.usage;
    const tokens = usage?.total_tokens ?? null;
    console.log('[DOUBAO] RESPONSE latencyMs=' + latencyMs + ' tokens=' + (tokens ?? 'null'));
    console.log('[DOUBAO] ========== 豆包返回的完整原始内容（未解析） ==========');
    console.log('[DOUBAO] RAW_FULL:\n' + (content ?? '(empty)'));
    console.log('[DOUBAO] ========== 以上为豆包返回结束 ==========');
    if (!content) throw new Error('Invalid Doubao response: no content in ' + JSON.stringify(res.data?.output ?? res.data).slice(0, 200));
    return {
      raw: content,
      provider: 'doubao',
      model: res.data?.model ?? model,
      tokens: tokens ?? null,
      latencyMs,
    };
  }

  /** 从 Responses API 多种可能返回结构中提取文本 */
  private extractDoubaoResponseContent(data: any): string | null {
    if (!data) return null;
    const o = data.output ?? data;
    if (typeof o?.output_text === 'string') return o.output_text;
    if (typeof o?.text === 'string') return o.text;
    const msg = o?.message ?? o?.messages?.[0];
    if (msg?.content) {
      if (typeof msg.content === 'string') return msg.content;
      if (Array.isArray(msg.content)) {
        const part = msg.content.find((p: any) => p?.type === 'output_text' || p?.type === 'text');
        return part?.text ?? null;
      }
    }
    const choices = data.choices ?? o?.choices;
    if (Array.isArray(choices) && choices[0]?.message?.content) return choices[0].message.content;
    return null;
  }

  async analyzeWithOpenAI(prompt: string, systemPrompt: string): Promise<AiCallResult> {
    const { apiKey, baseUrl } = await this.getOpenAIConfig();
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    console.log('[OPENAI] 调用前 SYSTEM_PROMPT_FULL:\n' + systemPrompt);
    console.log('[OPENAI] 调用前 USER_PROMPT_FULL:\n' + prompt);
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
    console.log('[OPENAI] 返回原始(未解析):\n' + (content ?? '(empty)'));
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
