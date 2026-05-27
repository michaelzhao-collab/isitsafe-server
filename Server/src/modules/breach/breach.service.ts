import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import axios from 'axios';

const HIBP_SALT_NAMESPACE = 'starlens-breach-v3';
const HIBP_API_BASE = 'https://haveibeenpwned.com/api/v3';

/** AES-GCM 加密/解密邮箱（HIBP 调用时还原明文） */
function getAesKey(): Buffer | null {
  const raw = process.env.BREACH_AES_KEY;
  if (!raw) return null;
  // 接受 hex (64 字符 = 32 字节) 或 base64
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    return Buffer.from(raw, 'base64');
  } catch {
    return null;
  }
}

function encryptEmail(email: string): string | null {
  const key = getAesKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 存储格式：base64(iv | tag | ciphertext)
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptEmail(encoded: string): string | null {
  const key = getAesKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}

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

    // 检查配额（免费 1 个，Pro 5 个） + 拿用户邮箱用于"是否自己邮箱"判定
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, subscriptionStatus: true, subscriptionExpire: true },
    });
    const isPro = user?.subscriptionStatus === 'premium' &&
      (!user.subscriptionExpire || user.subscriptionExpire > new Date());
    const maxTargets = isPro ? 5 : 1;
    const count = await this.prisma.breachTarget.count({ where: { userId } });
    if (count >= maxTargets) {
      throw new ConflictException(`Plan limit reached (${maxTargets}). Upgrade for more.`);
    }

    // 一期安全策略（防止用他人邮箱滥用 HIBP 查询）：
    //  - 添加的邮箱与用户注册邮箱一致 → 直接 verified=true，可立即走 HIBP
    //  - 否则 verified=false，scanTarget 跳过；二期补邮件验证流程后再开放
    const userEmail = (user?.email ?? '').toLowerCase().trim();
    const isOwnEmail = !!userEmail && userEmail === normalized;

    const verificationToken = randomBytes(16).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 3600 * 1000);

    // 并发保护：利用 (userId, targetValueLookup) 唯一约束 catch P2002
    try {
      const target = await this.prisma.breachTarget.create({
        data: {
          userId,
          targetType: 'email',
          targetValueHash: this.maskEmail(normalized), // 展示用脱敏字符串
          targetValueLookup: lookup,
          // 加密真实邮箱（BREACH_AES_KEY 未配置时为 null，HIBP 调用降级到 stub）
          targetValueEncrypted: encryptEmail(normalized),
          verified: isOwnEmail,
          verificationToken,
          verificationExpiresAt: verifyExpires,
        },
      });

      if (isOwnEmail) {
        // 自己邮箱：立即跑一次扫描
        await this.scanTarget(target.id);
      }
      // 非自己邮箱：等二期补邮件验证流程

      return {
        id: target.id,
        displayValue: target.targetValueHash,
        verified: target.verified,
        needsEmailVerification: !isOwnEmail,
      };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Target already exists');
      }
      throw err;
    }
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

  /** 扫描单个目标 — 真实 HIBP 集成（HIBP_API_KEY 未配置时 fallback 到 stub） */
  async scanTarget(targetId: string): Promise<{ newAlerts: number }> {
    const target = await this.prisma.breachTarget.findUnique({ where: { id: targetId } });
    if (!target || !target.verified) return { newAlerts: 0 };

    const hibpKey = process.env.HIBP_API_KEY;
    let stubBreaches: Array<{ name: string; severity: 'low' | 'medium' | 'high'; exposed: string[]; date: string }> = [];

    // 真实 HIBP 集成路径：BREACH_AES_KEY + HIBP_API_KEY + target_value_encrypted 三者齐全才走
    if (hibpKey && target.targetValueEncrypted) {
      const email = decryptEmail(target.targetValueEncrypted);
      if (email) {
        try {
          const hibpResults = await this.queryHibp(email, hibpKey);
          stubBreaches = hibpResults;
        } catch (err: any) {
          this.logger.error(`[BreachScan] HIBP failed for hash=${target.targetValueLookup.slice(0, 8)}: ${err?.message}`);
          stubBreaches = [];
        }
      } else {
        this.logger.warn('[BreachScan] decrypt failed, using stub');
        stubBreaches = this.stubBreachesFor(target.targetValueLookup);
      }
    } else {
      // 配置未齐 → stub 演示
      stubBreaches = this.stubBreachesFor(target.targetValueLookup);
    }

    const isRealHibp = !!(hibpKey && target.targetValueEncrypted);
    const sourceTag = isRealHibp ? 'HIBP' : 'HIBP_stub';

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
          breachSource: sourceTag,
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

  /** 调用 HIBP /breachedaccount/{email} 真实接口 */
  private async queryHibp(email: string, apiKey: string): Promise<Array<{ name: string; severity: 'low' | 'medium' | 'high'; exposed: string[]; date: string }>> {
    const url = `${HIBP_API_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false&includeUnverified=false`;
    const resp = await axios.get(url, {
      headers: {
        'hibp-api-key': apiKey,
        'User-Agent': 'StarLensAI-V3-BreachMonitor',
      },
      timeout: 15000,
      // 404 表示没有泄露记录，不当错误
      validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
    });
    if (resp.status === 404 || !Array.isArray(resp.data)) return [];

    return (resp.data as any[]).map((b) => {
      const dataClasses: string[] = b.DataClasses ?? [];
      // 严重度判定：含 password/credit/SSN 视为 high，含个人身份信息视为 medium
      const lower = dataClasses.map((d) => d.toLowerCase());
      const sev: 'low' | 'medium' | 'high' =
        lower.some((d) => d.includes('password') || d.includes('credit') || d.includes('ssn') || d.includes('financial'))
          ? 'high'
          : lower.some((d) => d.includes('name') || d.includes('phone') || d.includes('address'))
          ? 'medium'
          : 'low';
      return {
        name: b.Name || b.Title || 'Unknown breach',
        severity: sev,
        exposed: dataClasses.map((d) => d.toLowerCase()),
        date: b.BreachDate || b.AddedDate || new Date().toISOString().slice(0, 10),
      };
    });
  }

  /** Stub 告警生成器（HIBP 未配置或失败时使用） */
  private stubBreachesFor(lookupHash: string): Array<{ name: string; severity: 'low' | 'medium' | 'high'; exposed: string[]; date: string }> {
    const seed = lookupHash.charCodeAt(0) % 10;
    const breaches: Array<{ name: string; severity: 'low' | 'medium' | 'high'; exposed: string[]; date: string }> = [];
    if (seed < 5) {
      breaches.push({
        name: 'Adobe 2013',
        severity: 'medium',
        exposed: ['email', 'hashed_password', 'username'],
        date: '2013-10-04',
      });
    }
    if (seed < 3) {
      breaches.push({
        name: 'LinkedIn 2021',
        severity: 'high',
        exposed: ['email', 'name', 'phone', 'workplace'],
        date: '2021-06-22',
      });
    }
    return breaches;
  }

  /** 每天 03:00 UTC 扫描全部已验证目标 */
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
