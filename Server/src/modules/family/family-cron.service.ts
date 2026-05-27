import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FamilyService } from './family.service';

/**
 * V3-E 关怀机制 cron 服务
 *
 * 每天凌晨 01:00 扫描全量用户活跃情况：
 *   - 连续 2 天未活跃 → 发 push 给同家庭其他成员
 *   - 连续 3 天 → push + 短信（每家庭 1 条/天）
 *
 * Cron 失败不影响 V2 老业务；日志通过 Logger 输出，可以接 Sentry。
 */
@Injectable()
export class FamilyCronService {
  private readonly logger = new Logger(FamilyCronService.name);

  constructor(private familyService: FamilyService) {}

  /**
   * 每天凌晨 1:00 触发（北京时间 / 服务器时间）
   */
  @Cron('0 1 * * *', { name: 'family-care-scan' })
  async runDailyCareScan() {
    const start = Date.now();
    this.logger.log('[CareCron] start daily inactive scan');
    try {
      const result = await this.familyService.scanInactiveMembers();
      const elapsed = Date.now() - start;
      this.logger.log(
        `[CareCron] done in ${elapsed}ms scanned=${result.scanned} ` +
          `notified2d=${result.notified2days} notified3+=${result.notified3plus} sms=${result.smsSent}`,
      );
    } catch (err: any) {
      this.logger.error(`[CareCron] failed: ${err?.message}`, err?.stack);
    }
  }

  /**
   * 手动触发接口（admin/调试用）
   */
  async runNow() {
    return this.familyService.scanInactiveMembers();
  }
}
