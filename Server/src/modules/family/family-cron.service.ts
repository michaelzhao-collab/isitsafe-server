import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FamilyService } from './family.service';

/**
 * V3-E 关怀机制 cron 服务
 *
 * S3-6：从"服务器单点凌晨 1 点"改为"每小时跑一次 + 用户本地时区判定"
 *   - cron 改 hourly（每整点触发）
 *   - scanInactiveMembers 内按 user.regionCode → tz 计算每个用户的本地"今天"
 *   - 仅在用户本地早 9 点到晚 22 点之间触发新提醒，避免 3am 推送扰民
 *   - alreadySent 判定也按用户本地日，避免边界场景重复发
 *
 * Cron 失败不影响 V2 老业务；日志通过 Logger 输出，可以接 Sentry。
 */
@Injectable()
export class FamilyCronService {
  private readonly logger = new Logger(FamilyCronService.name);

  constructor(private familyService: FamilyService) {}

  /**
   * 每小时触发；具体某用户是否真正被检测，由 service 层按其本地时区决定
   */
  @Cron('0 * * * *', { name: 'family-care-scan' })
  async runHourlyCareScan() {
    const start = Date.now();
    this.logger.log('[CareCron] start hourly inactive scan');
    try {
      const result = await this.familyService.scanInactiveMembers();
      const elapsed = Date.now() - start;
      this.logger.log(
        `[CareCron] done in ${elapsed}ms scanned=${result.scanned} ` +
          `notified2d=${result.notified2days} notified3+=${result.notified3plus} ` +
          `sms=${result.smsSent} skippedOffHours=${result.skippedOffHours ?? 0}`,
      );
    } catch (err: any) {
      this.logger.error(`[CareCron] failed: ${err?.message}`, err?.stack);
    }
  }

  /**
   * 手动触发接口（admin/调试用）。忽略本地小时限制，立即按当前时刻评估。
   */
  async runNow() {
    return this.familyService.scanInactiveMembers({ ignoreLocalHourWindow: true });
  }
}
