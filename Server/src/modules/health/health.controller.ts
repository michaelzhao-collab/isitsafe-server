import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AI_V2, DEFAULT_DOUBAO_MODEL, PROMPT_VERSION } from '../../common/ai-flags';

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
      },
    };
  }
}
