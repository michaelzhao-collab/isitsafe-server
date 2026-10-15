import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AI_V2, DEFAULT_DOUBAO_MODEL, PROMPT_VERSION } from '../../common/ai-flags';
import { breachConfigStatus } from '../breach/breach.service';
import { aiCallDiagnostics } from '../ai/providers/ai-provider.service';

/**
 * 健康检查，方便小白测试
 * GET /api/health -> { "status": "ok", "ai": { "model": "...", "promptVersion": "...", "v2": true } }
 *
 * ai 字段只暴露当前生效的模型名 / 提示词版本 / 开关（不含密钥），用来确认 Railway 环境变量改动已生效。
 */
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return {
      status: 'ok',
      ai: {
        model: process.env.DOUBAO_MODEL || DEFAULT_DOUBAO_MODEL,
        thinking: process.env.DOUBAO_THINKING || 'disabled',
        promptVersion: PROMPT_VERSION,
        v2: AI_V2,
        // 主 / 备用服务商的环境变量覆盖（未设时由后台设置决定，见 lastProvider）与密钥是否存在（只给布尔）
        providerEnv: process.env.AI_PROVIDER || null,
        fallbackEnv: process.env.AI_FALLBACK_PROVIDER || null,
        keys: { doubao: !!process.env.DOUBAO_API_KEY, deepseek: !!process.env.DEEPSEEK_API_KEY },
        // 最近一次实际调用：服务商、成功时间 / 耗时、失败原因（2026-10-15）
        calls: aiCallDiagnostics,
      },
      // 数据泄露监控配置是否齐全（只给布尔，不含密钥）：hibp=false 时所有扫描都会显示「暂时无法扫描」
      breach: { ...breachConfigStatus(), mail: !!process.env.BREVO_API_KEY },
    };
  }
}
