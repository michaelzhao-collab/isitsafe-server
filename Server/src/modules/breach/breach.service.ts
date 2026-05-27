import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { createHash, randomBytes } from 'crypto';

const HIBP_SALT_NAMESPACE = 'starlens-breach-v3';

/**
 * V3-F 暗网监控服务（仅海外用户）
 *
 * 一期 stub：
 *  - HIBP API 接入留接口（产线接 https://haveibeenpwned.com/API/v3）
 *  - 邮箱验证：发邮件留接口（一期跳过验证直接返 success）
 *  - 每天 03:00 UTC 跑扫描 cron（一期跳过，二期接 HIBP）
 *
 * 数据安全：
 *  - target_value_lookup: SHA256(lower(email) + per-user salt)
 *  - target_value_hash: bcrypt(email) 用于"用户确认是自己的目标"展示
 *  - 永不在 DB 存明文邮箱
 */
@Injectable()
export class BreachService {
  private readonly logger = new Logger(BreachService.name);

  constructor(private prisma: PrismaService) {}

  // ====================================================================
  // 目标 CRUD
  // ====================================================================

  /**
   * 添加监控目标
   * 一期 stub：跳过邮件验证，直接 verified = true
   * 二期：verified=false + 发邮件，用户点链接才置 true
   */
  async addTarget(userId: string, email: string) {
    const normalized = email.toLowerCase().trim();
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(normalized)) {
      throw new ConflictException('Invalid email format');
    }
    const lookup = this.computeLookup(userId, normalized);

    // 防重复添加
    const existing = await this.prisma.breachTarget.findFirst({
      where: { userId, targetValueLookup: lookup },
    });
    if (existing) {
      throw new ConflictException('Target already exists');
    }

    // 检查配额（免费 1 个，Pro 5 个）
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionExpire: true },
    });
    const isPro = user?.subscriptionStatus === 'premium' &&
      (!user.subscriptionExpire || user.subscriptionExpire > new Date());
    const maxTargets = isPro ? 5 : 1;
    const count = await this.prisma.breachTarget.count({ where: { userId } });
    if (count >= maxTargets) {
      throw new ConflictException(`Plan limit reached (${maxTargets}). Upgrade for more.`);
    }

    const verificationToken = randomBytes(16).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 3600 * 1000);

    const target = await this.prisma.breachTarget.create({
      data: {
        userId,
        targetType: 'email',
        targetValueHash: this.maskEmail(normalized), // 一期：展示用脱敏字符串
        targetValueLookup: lookup,
        // 一期 stub：跳过邮件验证直接 verified=true（二期改回 false + 发邮件）
        verified: true,
        verificationToken,
        verificationExpiresAt: verifyExpires,
      },
    });

    // TODO 二期：发验证邮件 + 上线后改 verified: false
    // await this.email.send({ to: email, subject: 'Verify your monitoring target', ... })

    // 立即跑一次扫描（一期 stub 返回 0 个告警）
    await this.scanTarget(target.id);

    return {
      id: target.id,
      displayValue: target.targetValueHash,
      verified: target.verified,
    };
  }

  /** 邮件验证回调（二期使用） */
  async verifyTarget(userId: string, targetId: string, token: string) {
    const target = await this.prisma.breachTarget.findUnique({ where: { id: targetId } });
    if (!target || target.userId !== userId) throw new NotFoundException();
    if (target.verified) return { success: true, alreadyVerified: true };
    if (target.verificationToken !== token) throw new ForbiddenException('Invalid token');
    if (target.verificationExpiresAt && target.verificationExpiresAt < new Date()) {
      throw new ForbiddenException('Token expired');
    }
    await this.prisma.breachTarget.update({
      where: { id: targetId },
      data: {
        verified: true,
        verificationToken: null,
        verificationExpiresAt: null,
      },
    });
    await this.scanTarget(targetId);
    return { success: true };
  }

  async listTargets(userId: string) {
    const targets = await this.prisma.breachTarget.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        targetType: true,
        targetValueHash: true,
        verified: true,
        lastScannedAt: true,
        createdAt: true,
        _count: { select: { alerts: true } },
      },
    });
    return targets.map((t) => ({
      id: t.id,
      type: t.targetType,
      displayValue: t.targetValueHash,
      verified: t.verified,
      lastScannedAt: t.lastScannedAt,
      alertCount: t._count.alerts,
      createdAt: t.createdAt,
    }));
  }

  async deleteTarget(userId: string, targetId: string) {
    const target = await this.prisma.breachTarget.findUnique({ where: { id: targetId } });
    if (!target || target.userId !== userId) throw new NotFoundException();
    await this.prisma.breachTarget.delete({ where: { id: targetId } });
    return { success: true };
  }

  // ====================================================================
  // 告警
  // ====================================================================

  async listAlerts(userId: string, limit = 50) {
    return this.prisma.breachAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  async dismissAlert(userId: string, alertId: string) {
    const alert = await this.prisma.breachAlert.findUnique({ where: { id: alertId } });
    if (!alert || alert.userId !== userId) throw new NotFoundException();
    await this.prisma.breachAlert.update({
      where: { id: alertId },
      data: { dismissed: true },
    });
    return { success: true };
  }

  // ====================================================================
  // 扫描（一期 stub，二期接 HIBP）
  // ====================================================================

  /** 扫描单个目标 */
  async scanTarget(targetId: string): Promise<{ newAlerts: number }> {
    const target = await this.prisma.breachTarget.findUnique({ where: { id: targetId } });
    if (!target || !target.verified) return { newAlerts: 0 };

    // 一期 stub：根据 hash 决定性返回 0~2 个告警，便于演示
    const seed = target.targetValueLookup.charCodeAt(0) % 10;
    const stubBreaches: Array<{ name: string; severity: 'low' | 'medium' | 'high'; exposed: string[]; date: string }> = [];
    if (seed < 5) {
      stubBreaches.push({
        name: 'Adobe 2013',
        severity: 'medium',
        exposed: ['email', 'hashed_password', 'username'],
        date: '2013-10-04',
      });
    }
    if (seed < 3) {
      stubBreaches.push({
        name: 'LinkedIn 2021',
        severity: 'high',
        exposed: ['email', 'name', 'phone', 'workplace'],
        date: '2021-06-22',
      });
    }

    let newAlerts = 0;
    for (const b of stubBreaches) {
      // 去重：同 target + 同 breach_name 不重复发
      const exists = await this.prisma.breachAlert.findFirst({
        where: { targetId, breachName: b.name },
      });
      if (exists) continue;
      await this.prisma.breachAlert.create({
        data: {
          targetId,
          userId: target.userId,
          breachSource: 'HIBP_stub',
          breachName: b.name,
          breachDate: new Date(b.date),
          exposedData: b.exposed as any,
          severity: b.severity,
        },
      });
      newAlerts += 1;
    }

    await this.prisma.breachTarget.update({
      where: { id: targetId },
      data: { lastScannedAt: new Date() },
    });
    return { newAlerts };
  }

  /** 每天 03:00 UTC 扫描全部已验证目标（一期 stub） */
  @Cron('0 3 * * *', { name: 'breach-daily-scan' })
  async runDailyScan() {
    const start = Date.now();
    this.logger.log('[BreachCron] start daily scan');
    try {
      const targets = await this.prisma.breachTarget.findMany({
        where: { verified: true },
        select: { id: true },
      });
      let totalNew = 0;
      for (const t of targets) {
        const r = await this.scanTarget(t.id);
        totalNew += r.newAlerts;
      }
      const elapsed = Date.now() - start;
      this.logger.log(`[BreachCron] done in ${elapsed}ms scanned=${targets.length} newAlerts=${totalNew}`);
    } catch (err: any) {
      this.logger.error(`[BreachCron] failed: ${err?.message}`, err?.stack);
    }
  }

  // ====================================================================
  // 内部工具
  // ====================================================================
  private computeLookup(userId: string, email: string): string {
    return createHash('sha256')
      .update(`${HIBP_SALT_NAMESPACE}:${userId}:${email}`)
      .digest('hex');
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local[0]}${'*'.repeat(Math.min(4, local.length - 2))}${local.slice(-1)}@${domain}`;
  }
}
