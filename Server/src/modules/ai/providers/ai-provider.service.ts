/**
 * AI Provider：doubao / deepseek / openai / other(预留)
 * Key 优先从 .env，其次从 settings 表读取
 *
 * 主备策略：analyze() 默认按 settings.defaultProvider 调用主 provider；
 * 主 provider 抛错时（网络/超时/限流/5xx）自动切到 settings.fallbackProvider，
 * 备用也失败则向上抛原始错误。如需强制使用特定 provider，传入 provider 参数。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AI_DEBUG_LOG, DEFAULT_DOUBAO_MODEL } from '../../../common/ai-flags';
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
  private readonly logger = new Logger(AiProviderService.name);

  constructor(
    private config: ConfigService,
    private settings: SettingsService,
  ) {}

  async getDefaultProvider(): Promise<AiProviderName> {
    return this.settings.getDefaultProvider();
  }

  private async getDoubaoConfig() {
    const key = await this.settings.getDoubaoKey() ?? this.config.get('DOUBAO_API_KEY');
    // baseUrl 优先级：DOUBAO_API_URL env > AI_BASE_URL/Settings.aiBaseUrl（兼容旧配置）> 默认 ark
    // 之前的部署可能把豆包代理写在 AI_BASE_URL 里（Railway 新加坡直连北京 ark 不稳定），必须保留此回落
    const baseUrl =
      this.config.get('DOUBAO_API_URL') ||
      (await this.settings.getAiBaseUrl()) ||
      'https://ark.cn-beijing.volces.com/api/v3';
    return { apiKey: key, baseUrl };
  }

  private async getDeepseekConfig() {
    const key = await this.settings.getDeepseekKey() ?? this.config.get('DEEPSEEK_API_KEY');
    const baseUrl = this.config.get('DEEPSEEK_API_URL', 'https://api.deepseek.com/v1');
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
    // 2026-10-06：默认切到 seed-2.1-lite（2.0 官方标「即将下线」；31 场景实测 lite 速度/判定与 2.0-pro 持平、更便宜）
    const model = this.config.get('DOUBAO_MODEL', DEFAULT_DOUBAO_MODEL);
    // 深度思考默认关闭：开着时每次先「想」300–570 token，单次 8–15 秒；关掉后 2.5–6 秒，31 场景判定不变。DOUBAO_THINKING=enabled 可恢复
    const thinkingType = this.config.get('DOUBAO_THINKING', 'disabled');
    // 官方文档：/api/v3/responses 的 input 为消息数组，支持 system/user 角色。
    // 2026-09-27 复核（提示注入防护）：原来把 systemPrompt 和用户内容合并成单条 user 消息，
    // 用户内容里的"系统提示"更易被模型误当指令。改为 system 与 user 分离，配合 systemPrompt
    // 里的安全边界声明与 ⟦INPUT⟧ 定界符，降低注入成功率（deepseek/openai 路径本就是分离的）。
    const body = {
      model,
      thinking: { type: thinkingType },
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
        { role: 'user', content: [{ type: 'input_text', text: prompt }] },
      ],
    };
    const requestUrl = `${baseUrl}/responses`;
    console.log('[DOUBAO] REQUEST URL=' + requestUrl + ' model=' + model + ' systemPromptLen=' + systemPrompt.length + ' userPromptLen=' + prompt.length);
    if (AI_DEBUG_LOG) {
      // 含用户原文（个人信息），默认不打；排障时 Railway 设 AI_DEBUG_LOG=true
      console.log('[DOUBAO] SYSTEM_PROMPT_FULL:\n' + systemPrompt);
      console.log('[DOUBAO] USER_PROMPT_FULL:\n' + prompt);
    }
    // 火山引擎/豆包官方文档未明确单次请求超时秒数，此处与客户端统一使用 300 秒，避免长推理被中途断开
    // 2026-10-06：检测实测关闭思考后 p90 约 5.4 秒；本方法还被情报翻译 / 情报内容生成复用（输出更长），
    // 取 45 秒兼顾两者（原 300 秒会让用户干等 5 分钟）。可用 DOUBAO_TIMEOUT_MS 覆盖
    const DOUBAO_REQUEST_TIMEOUT_MS = Number(this.config.get('DOUBAO_TIMEOUT_MS', '45000'));
    const start = Date.now();
    const res = await axios.post(requestUrl, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: DOUBAO_REQUEST_TIMEOUT_MS,
    });
    const latencyMs = Date.now() - start;
    if (AI_DEBUG_LOG) {
      try { console.log('[DOUBAO] API_RESPONSE_RAW_BODY:\n' + JSON.stringify(res.data, null, 2)); } catch (_) {}
    }
    const content = this.extractDoubaoResponseContent(res.data);
    const usage = res.data?.usage ?? res.data?.output?.usage;
    const tokens = usage?.total_tokens ?? null;
    console.log('[DOUBAO] RESPONSE latencyMs=' + latencyMs + ' tokens=' + (tokens ?? 'null'));
    if (AI_DEBUG_LOG) console.log('[DOUBAO] RAW_FULL:\n' + (content ?? '(empty)'));
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
    // 豆包 Responses API：output 为数组，首项可能为 reasoning，第二项为 type: "message" 且 content 中含 type: "output_text"
    const output = data.output;
    if (Array.isArray(output)) {
      const messageItem = output.find((item: any) => item.type === 'message');
      if (messageItem?.content && Array.isArray(messageItem.content)) {
        const textPart = messageItem.content.find((p: any) => p.type === 'output_text');
        if (typeof textPart?.text === 'string') return textPart.text;
      }
    }
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

  /**
   * DeepSeek：OpenAI 兼容 Chat Completions 协议
   * 默认模型 deepseek-chat（V3.x），可在 .env 中改为 deepseek-reasoner 走 R1 模式。
   * 由于 R1 模式延迟较高（10s+），用作"备用 + 主失败兜底"很合适。
   */
  async analyzeWithDeepseek(prompt: string, systemPrompt: string): Promise<AiCallResult> {
    const { apiKey, baseUrl } = await this.getDeepseekConfig();
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
    const model = this.config.get('DEEPSEEK_MODEL', 'deepseek-chat');
    const requestUrl = `${baseUrl}/chat/completions`;
    console.log('[DEEPSEEK] REQUEST URL=' + requestUrl + ' model=' + model + ' systemPromptLen=' + systemPrompt.length + ' userPromptLen=' + prompt.length);
    // 与豆包对齐 300s 超时上限，留出 reasoner 模式的余量
    const TIMEOUT_MS = 300 * 1000;
    const start = Date.now();
    const res = await axios.post(
      requestUrl,
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        // 强制 JSON 响应（DeepSeek 支持 response_format）；解析失败仍会被 parseAndValidateAiOutput 兜底
        response_format: { type: 'json_object' },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: TIMEOUT_MS,
      },
    );
    const latencyMs = Date.now() - start;
    const content = res.data?.choices?.[0]?.message?.content;
    const usage = res.data?.usage;
    console.log('[DEEPSEEK] RESPONSE latencyMs=' + latencyMs + ' tokens=' + (usage?.total_tokens ?? 'null'));
    if (AI_DEBUG_LOG) console.log('[DEEPSEEK] RAW_FULL:\n' + (content ?? '(empty)'));
    if (!content) throw new Error('Invalid DeepSeek response: no content');
    return {
      raw: content,
      provider: 'deepseek',
      model: res.data?.model ?? model,
      tokens: usage?.total_tokens ?? null,
      latencyMs,
    };
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

  private callProvider(
    provider: AiProviderName,
    prompt: string,
    systemPrompt: string,
  ): Promise<AiCallResult> {
    if (provider === 'deepseek') return this.analyzeWithDeepseek(prompt, systemPrompt);
    if (provider === 'openai') return this.analyzeWithOpenAI(prompt, systemPrompt);
    if (provider === 'other') return this.analyzeWithOther(prompt, systemPrompt);
    return this.analyzeWithDoubao(prompt, systemPrompt);
  }

  /**
   * 调用主 provider，失败自动切换备用 provider 重试一次。
   * - provider 参数为"建议的主 provider"，省略时按 settings.defaultProvider；任何情况下失败都会尝试 fallback
   * - 主/备相同 或 备用未配置时，直接抛主错误
   * - 兜底成功时记录 [AI_FAILOVER_OK]，方便排查；失败时记录 [AI_FAILOVER_FAILED] 抛主错误
   *
   * 注意：之前的版本里 `if (provider) return callProvider(...)` 提前 return 导致 fallback 永远不触发，
   * 而 ai.service.ts 总是显式传 provider —— 等于 fallback 完全是死代码。此处修复。
   */
  async analyze(
    prompt: string,
    systemPrompt: string,
    provider?: AiProviderName,
  ): Promise<AiCallResult> {
    const primary = provider ?? (await this.getDefaultProvider());
    try {
      return await this.callProvider(primary, prompt, systemPrompt);
    } catch (primaryErr: any) {
      const fallback = await this.settings.getFallbackProvider();
      if (!fallback || fallback === primary) {
        throw primaryErr;
      }
      this.logger.warn(
        `[AI_FAILOVER] primary=${primary} failed (${primaryErr?.message ?? primaryErr}); trying fallback=${fallback}`,
      );
      try {
        const result = await this.callProvider(fallback, prompt, systemPrompt);
        this.logger.warn(`[AI_FAILOVER_OK] primary=${primary} → fallback=${fallback} succeeded`);
        return result;
      } catch (fallbackErr: any) {
        this.logger.error(
          `[AI_FAILOVER_FAILED] primary=${primary} fallback=${fallback} both failed`,
          { primary: primaryErr?.message, fallback: fallbackErr?.message },
        );
        // 抛主 provider 的错误，调用方语义更稳定
        throw primaryErr;
      }
    }
  }
}
