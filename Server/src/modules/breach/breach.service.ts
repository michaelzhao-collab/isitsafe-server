import {
  Injectable,
  NotFoundException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { Cron } from '@nestjs/schedule';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual, createCipheriv, createDecipheriv } from 'crypto';
import axios from 'axios';

type Lang = 'zh' | 'en';
const tr = (lang: Lang, zh: string, en: string) => (lang === 'zh' ? zh : en);

/** 2026-10-14：扫描状态存 Redis（不改表结构）。failed 时客户端显示「暂时无法扫描」而不是绿色「安全」 */
export type ScanStatus = 'ok' | 'failed' | 'pending_verification' | 'never';
type ScanFailReason = 'not_configured' | 'decrypt' | 'rate_limited' | 'auth' | 'upstream' | 'invalid_email' | 'needs_readd';
const SCAN_STATUS_KEY = 'breach:scan:';
const SCAN_STATUS_TTL = 14 * 24 * 3600;
/** 免费数据源只给「该邮箱在所有泄露里合计暴露过的数据类型」，按目标存一份（不挂到每条告警上，否则每条都像泄露了 SSN） */
const EXPOSED_SUMMARY_KEY = 'breach:exposed:';

/** 邮箱验证码 */
const CODE_TTL_SEC = 30 * 60;
const CODE_RESEND_COOLDOWN_SEC = 60;
const CODE_MAX_SENDS_PER_USER_HOUR = 10;
const CODE_MAX_ATTEMPTS = 5;
const CODE_COOLDOWN_KEY = 'breach:code:cd:';
const CODE_USER_QUOTA_KEY = 'breach:code:user:';
const CODE_ATTEMPTS_KEY = 'breach:code:att:';
/** 按收件人限流（不带用户盐，防多账号轰炸同一邮箱）+ 全局每日上限（保护与登录验证码共用的 Brevo 额度） */
const CODE_RECIPIENT_HOUR_KEY = 'breach:code:to:h:';
const CODE_RECIPIENT_DAY_KEY = 'breach:code:to:d:';
const CODE_GLOBAL_DAY_KEY = 'breach:code:global:';
const CODE_MAX_PER_RECIPIENT_HOUR = 3;
const CODE_MAX_PER_RECIPIENT_DAY = 5;
const CODE_MAX_GLOBAL_DAY = Math.max(1, Number(process.env.BREACH_CODE_DAILY_CAP) || 200);
const CRON_LOCK_KEY = 'breach:cron:lock';
const APPLE_RELAY_SUFFIX = '@privaterelay.appleid.com';

/** 每分钟请求上限：HIBP 按套餐（Core 1 = 10 RPM，可用 HIBP_RPM 覆盖）；LeakCheck 公共接口 1 次/秒，留余量按 45 */
const HIBP_RPM = (() => {
  const n = Number(process.env.HIBP_RPM);
  return Number.isFinite(n) && n >= 1 ? n : 10;
})();
const providerRpm = () => (breachProvider() === 'hibp' ? HIBP_RPM : 45);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class HibpError extends Error {
  constructor(public reason: ScanFailReason, message: string) {
    super(message);
  }
}

/** 配置状态（/api/health 暴露，不含密钥本身） */
export function breachConfigStatus() {
  const key = getAesKey();
  return {
    provider: breachProvider(),
    hibp: !!process.env.HIBP_API_KEY,
    aes: !!key && key.length === 32,
    aesSource: process.env.BREACH_AES_KEY ? 'env' : 'derived',
  };
}

const HIBP_SALT_NAMESPACE = 'starlens-breach-v3';
const HIBP_API_BASE = 'https://haveibeenpwned.com/api/v3';
/** 2026-10-14：免费数据源。产品要求不用付费 HIBP —— 没配 HIBP_API_KEY 时改用 LeakCheck Public API
 *  （官方允许商用，要求页面放「Powered by LeakCheck」链接；限速 1 次/秒） */
const LEAKCHECK_PUBLIC_URL = 'https://leakcheck.io/api/public';
export type BreachProvider = 'hibp' | 'leakcheck';
function breachProvider(): BreachProvider {
  return process.env.HIBP_API_KEY ? 'hibp' : 'leakcheck';
}

/** AES-GCM 加密/解密邮箱（查询时还原明文）。
 *  未单独配置 BREACH_AES_KEY 时由 JWT_SECRET 派生（生产环境 JWT_SECRET 必配）。
 *  注意：派生后若更换 JWT_SECRET，已保存的邮箱将无法解密（扫描显示失败，用户需重新添加）。 */
function getAesKey(): Buffer | null {
  const raw = process.env.BREACH_AES_KEY;
  if (!raw) {
    const jwt = process.env.JWT_SECRET?.trim();
    return jwt ? createHash('sha256').update(`starlens-breach-aes-v1:${jwt}`).digest() : null;
  }
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
  // 2026-10-14：key 解码后不足 32 字节时 createCipheriv 会抛错 → 所有添加请求 500（09-27 复核记录过）
  if (!key || key.length !== 32) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 存储格式：base64(iv | tag | ciphertext)
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptEmail(encoded: string): string | null {
  const key = getAesKey();
  if (!key || key.length !== 32) return null;
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

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private mail: MailService,
  ) {}

  // ====================================================================
  // 目标 CRUD
  // ====================================================================

  /**
   * 添加监控目标（2026-10-14 补邮件验证）
   *  - 与登录邮箱一致 → 直接 verified，立即扫描
   *  - 其它邮箱 → 发 6 位验证码到该邮箱，用户在 App 内输入后才扫描（防止查别人的邮箱）
   *  - 未验证且已过期的目标会被清掉，不长期占名额
   */
  async addTarget(userId: string, email: string, lang: Lang = 'en') {
    const normalized = email.toLowerCase().trim();
    if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(normalized)) {
      throw new HttpException({ message: tr(lang, '邮箱格式不正确', 'Invalid email format'), code: 'breach_invalid_email' }, HttpStatus.BAD_REQUEST);
    }
    if (normalized.endsWith(APPLE_RELAY_SUFFIX)) {
      throw new HttpException({
        message: tr(lang, '这是 Apple 隐藏邮箱的转发地址，泄露库里查不到它。请添加你真实使用的邮箱。',
          'This is an Apple Hide My Email relay address. Breach databases never contain it — add the email you actually use.'),
        code: 'breach_relay_email',
      }, HttpStatus.BAD_REQUEST);
    }
    // 没有加密密钥就无法安全保存邮箱、也无法扫描：直接说明不可用，不保存一个永远扫不了的目标
    if (!breachConfigStatus().aes) {
      this.logger.error('[Breach] BREACH_AES_KEY missing or invalid (must decode to 32 bytes)');
      throw this.unavailable(lang);
    }
    const encrypted = encryptEmail(normalized);
    if (!encrypted) throw this.unavailable(lang);

    const lookup = this.computeLookup(userId, normalized);
    await this.purgeExpiredPending(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, subscriptionStatus: true, subscriptionExpire: true },
    });
    const isPro = user?.subscriptionStatus === 'premium' &&
      (!user.subscriptionExpire || user.subscriptionExpire > new Date());
    const maxTargets = isPro ? 5 : 1;
    const count = await this.prisma.breachTarget.count({ where: { userId } });
    // 重新添加「旧数据（没加密、扫不了）」的同一个邮箱：只是补密文，不算新增名额
    const legacySame = await this.prisma.breachTarget.findFirst({
      where: { userId, targetValueLookup: lookup, targetValueEncrypted: null },
      select: { id: true },
    });
    if (count >= maxTargets && !legacySame) {
      throw new HttpException({
        message: tr(lang, `已达到当前套餐上限（${maxTargets} 个邮箱）。升级会员可监控更多。`, `Plan limit reached (${maxTargets}). Upgrade for more.`),
        code: 'breach_plan_limit',
        limit: maxTargets,
      }, HttpStatus.CONFLICT);
    }

    const userEmail = (user?.email ?? '').toLowerCase().trim();
    const isOwnEmail = !!userEmail && userEmail === normalized;

    let target;
    try {
      target = await this.prisma.breachTarget.create({
        data: {
          userId,
          targetType: 'email',
          targetValueHash: this.maskEmail(normalized),
          targetValueLookup: lookup,
          targetValueEncrypted: encrypted,
          verified: isOwnEmail,
          verificationToken: null,
          // 先写过期时间：issueCode 写入前的并发 list/add 不会把它当「过期待验证」清掉
          verificationExpiresAt: isOwnEmail ? null : new Date(Date.now() + CODE_TTL_SEC * 1000),
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // 复核 P1：今天之前加的目标当时没有加密密钥，targetValueEncrypted 为 null，永远扫不了。
        // 用户重新添加同一个邮箱时补上密文，而不是报「已存在」
        const legacy = await this.prisma.breachTarget.findFirst({ where: { userId, targetValueLookup: lookup } });
        if (legacy && !legacy.targetValueEncrypted) {
          target = await this.prisma.breachTarget.update({
            where: { id: legacy.id },
            data: { targetValueEncrypted: encrypted, verified: isOwnEmail || legacy.verified },
          });
        } else {
          throw new HttpException({ message: tr(lang, '该邮箱已在监控中', 'Target already exists'), code: 'breach_exists' }, HttpStatus.CONFLICT);
        }
      } else {
        throw err;
      }
    }
    if (!target) throw this.unavailable(lang);

    if (isOwnEmail) {
      const r = await this.scanTarget(target.id, { interactive: true });
      return {
        id: target.id,
        displayValue: target.targetValueHash,
        verified: true,
        needsEmailVerification: false,
        scanStatus: r.ok ? 'ok' : 'failed',
      };
    }

    // 其它邮箱：发验证码；发送失败则撤销这条目标，不占名额
    try {
      await this.issueCode(userId, target.id, normalized, lang);
    } catch (err) {
      await this.prisma.breachTarget.delete({ where: { id: target.id } }).catch(() => undefined);
      throw err;
    }
    return {
      id: target.id,
      displayValue: target.targetValueHash,
      verified: false,
      needsEmailVerification: true,
      codeExpiresInSeconds: CODE_TTL_SEC,
      resendCooldownSeconds: CODE_RESEND_COOLDOWN_SEC,
      scanStatus: 'pending_verification',
    };
  }

  /** 重发验证码 */
  async resendCode(userId: string, targetId: string, lang: Lang = 'en') {
    const target = await this.prisma.breachTarget.findUnique({ where: { id: targetId } });
    if (!target || target.userId !== userId) throw new NotFoundException();
    if (target.verified) return { success: true, alreadyVerified: true };
    const email = target.targetValueEncrypted ? decryptEmail(target.targetValueEncrypted) : null;
    if (!email) throw this.unavailable(lang);
    await this.issueCode(userId, targetId, email, lang);
    return { success: true, codeExpiresInSeconds: CODE_TTL_SEC, resendCooldownSeconds: CODE_RESEND_COOLDOWN_SEC };
  }

  /** 校验验证码（一次性、最多 5 次、30 分钟有效；Redis 不可用时一律拒绝） */
  async verifyTarget(userId: string, targetId: string, code: string, lang: Lang = 'en') {
    const target = await this.prisma.breachTarget.findUnique({ where: { id: targetId } });
    if (!target || target.userId !== userId) throw new NotFoundException();
    if (target.verified) return { success: true, alreadyVerified: true };

    const invalid = () => new HttpException({ message: tr(lang, '验证码不正确', 'Incorrect code'), code: 'breach_code_invalid' }, HttpStatus.BAD_REQUEST);
    if (!target.verificationToken && target.verificationExpiresAt && target.verificationExpiresAt > new Date()) {
      throw new HttpException({
        message: tr(lang, '输错次数过多，请重新发送验证码', 'Too many attempts. Please send a new code.'),
        code: 'breach_too_many_attempts',
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!target.verificationToken || !target.verificationExpiresAt || target.verificationExpiresAt < new Date()) {
      throw new HttpException({
        message: tr(lang, '验证码已过期，请重新发送', 'The code has expired. Please send a new one.'),
        code: 'breach_code_expired',
      }, HttpStatus.BAD_REQUEST);
    }
    let attempts: number;
    try {
      const client = this.redis.getClient();
      attempts = await client.incr(CODE_ATTEMPTS_KEY + targetId);
      if (attempts === 1) await client.expire(CODE_ATTEMPTS_KEY + targetId, CODE_TTL_SEC);
    } catch {
      throw this.unavailable(lang);
    }
    if (attempts > CODE_MAX_ATTEMPTS) {
      // 作废当前验证码但保留目标（过期时间不动），用户可以点「重新发送」
      await this.prisma.breachTarget.update({ where: { id: targetId }, data: { verificationToken: null } });
      throw new HttpException({
        message: tr(lang, '输错次数过多，请重新发送验证码', 'Too many attempts. Please send a new code.'),
        code: 'breach_too_many_attempts',
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const given = this.hashCode(targetId, String(code || '').trim());
    const expected = Buffer.from(target.verificationToken, 'hex');
    const actual = Buffer.from(given, 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid();

    await this.prisma.breachTarget.update({
      where: { id: targetId },
      data: { verified: true, verificationToken: null, verificationExpiresAt: null },
    });
    await this.redis.getClient().del(CODE_ATTEMPTS_KEY + targetId).catch(() => undefined);
    const r = await this.scanTarget(targetId, { interactive: true });
    return { success: true, scanStatus: r.ok ? 'ok' : 'failed' };
  }

  async listTargets(userId: string) {
    await this.purgeExpiredPending(userId);
    const targets = await this.prisma.breachTarget.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        targetType: true,
        targetValueHash: true,
        verified: true,
        verificationExpiresAt: true,
        lastScannedAt: true,
        createdAt: true,
        _count: { select: { alerts: true } },
      },
    });
    const statuses = await this.readScanStatuses(targets.map((t) => t.id));
    const summaries = new Map<string, string[]>();
    try {
      const vals = targets.length ? await this.redis.getClient().mget(targets.map((t) => EXPOSED_SUMMARY_KEY + t.id)) : [];
      vals.forEach((v, i) => { if (v) { try { summaries.set(targets[i].id, JSON.parse(v)); } catch { /* ignore */ } } });
    } catch { /* ignore */ }
    return targets.map((t) => {
      const st = statuses.get(t.id);
      const scanStatus: ScanStatus = !t.verified
        ? 'pending_verification'
        // 没有 Redis 状态时不能凭 lastScannedAt 判 ok：旧代码在 HIBP 未配置 / 失败时也会写 lastScannedAt
        : st?.status ?? 'never';
      return {
        id: t.id,
        type: t.targetType,
        displayValue: t.targetValueHash,
        verified: t.verified,
        verificationExpiresAt: t.verificationExpiresAt,
        lastScannedAt: t.lastScannedAt,
        scanStatus,
        scanFailReason: scanStatus === 'failed' ? st?.reason ?? null : null,
        alertCount: t._count.alerts,
        createdAt: t.createdAt,
        dataSource: breachProvider(),
        exposedSummary: summaries.get(t.id) ?? null,
      };
    });
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
    const rows = await this.prisma.breachAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    // 旧算法几乎全判成 medium，且告警按名称去重不会重算 —— 展示时按 exposedData 现算
    return rows.map((r) => {
      const exposed = Array.isArray(r.exposedData) ? (r.exposedData as unknown[]).filter((x): x is string => typeof x === 'string') : [];
      return exposed.length && r.breachSource === 'HIBP' ? { ...r, severity: BreachService.severityFor(exposed) } : r;
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

  /**
   * 扫描单个目标。2026-10-14：失败不再当成「没有泄露」——
   * 没配 key / 解密失败 / HIBP 限流或报错时记 failed，不更新 lastScannedAt，客户端据此显示「暂时无法扫描」。
   */
  async scanTarget(targetId: string, opts: { interactive?: boolean } = {}): Promise<{ newAlerts: number; ok: boolean; reason?: ScanFailReason }> {
    const target = await this.prisma.breachTarget.findUnique({ where: { id: targetId } });
    if (!target || !target.verified) return { newAlerts: 0, ok: false };

    const hibpKey = process.env.HIBP_API_KEY;
    const provider = breachProvider();
    let breaches: Array<{ name: string; severity: 'low' | 'medium' | 'high'; exposed: string[]; date: string }>;
    let sourceTag = provider === 'hibp' ? 'HIBP' : 'LeakCheck';

    if (process.env.BREACH_ALLOW_STUB === 'true' && !hibpKey && process.env.BREACH_STUB_ONLY === 'true') {
      breaches = this.stubBreachesFor(target.targetValueLookup);
      sourceTag = 'stub';
    } else {
      if (!target.targetValueEncrypted) {
        // 旧数据（当时没配加密密钥）：只能让用户删除后重新添加
        await this.writeScanStatus(targetId, 'failed', 'needs_readd');
        return { newAlerts: 0, ok: false, reason: 'needs_readd' };
      }
      const email = decryptEmail(target.targetValueEncrypted);
      if (!email) {
        this.logger.warn(`[BreachScan] decrypt failed target=${targetId}`);
        await this.writeScanStatus(targetId, 'failed', 'decrypt');
        return { newAlerts: 0, ok: false, reason: 'decrypt' };
      }
      try {
        // 用户操作路径（添加 / 验证）不做 429 等待重试，避免请求被拖到客户端超时；失败留给每日扫描
        let summary: string[] | null = null;
        if (provider === 'hibp') {
          breaches = await this.queryHibp(email, hibpKey as string, opts.interactive ? 0 : 3);
        } else {
          const r = await this.queryLeakCheck(email, opts.interactive ? 1 : 3);
          breaches = r.breaches;
          summary = r.exposedSummary;
        }
        if (summary) {
          await this.redis.getClient()
            .set(EXPOSED_SUMMARY_KEY + targetId, JSON.stringify(summary), 'EX', SCAN_STATUS_TTL)
            .catch(() => undefined);
        }
      } catch (err: any) {
        const reason: ScanFailReason = err instanceof HibpError ? err.reason : 'upstream';
        this.logger.error(`[BreachScan] ${provider} failed target=${targetId} reason=${reason}: ${err?.message}`);
        await this.writeScanStatus(targetId, 'failed', reason);
        return { newAlerts: 0, ok: false, reason };
      }
    }

    // 一次取已有名称 + createMany（常见邮箱一次可能有 200+ 个来源，原来逐条 findFirst+create 是 N+1）
    const existing = new Set(
      (await this.prisma.breachAlert.findMany({ where: { targetId }, select: { breachName: true } })).map((r) => r.breachName),
    );
    const fresh = breaches.filter((b) => !existing.has(b.name));
    if (fresh.length) {
      await this.prisma.breachAlert.createMany({
        data: fresh.map((b) => ({
          targetId,
          userId: target.userId,
          breachSource: sourceTag,
          breachName: b.name,
          breachDate: b.date ? new Date(b.date) : null,
          exposedData: b.exposed as any,
          severity: b.severity,
        })),
      });
    }
    const newAlerts = fresh.length;

    await this.prisma.breachTarget.update({ where: { id: targetId }, data: { lastScannedAt: new Date() } });
    await this.writeScanStatus(targetId, 'ok');
    return { newAlerts, ok: true };
  }

  /** 调用 HIBP /breachedaccount/{email}；429 按 retry-after 等待重试（最多 3 次） */
  private async queryHibp(email: string, apiKey: string, maxRetries = 3): Promise<Array<{ name: string; severity: 'low' | 'medium' | 'high'; exposed: string[]; date: string }>> {
    const url = `${HIBP_API_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false&includeUnverified=false`;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let resp;
      try {
        resp = await axios.get(url, {
          headers: { 'hibp-api-key': apiKey, 'User-Agent': 'StarLensAI-BreachMonitor' },
          timeout: 15000,
          validateStatus: () => true,
        });
      } catch (err: any) {
        throw new HibpError('upstream', err?.message || 'network error');
      }
      if (resp.status === 404) return [];
      if (resp.status === 429) {
        if (attempt >= maxRetries) throw new HibpError('rate_limited', 'HIBP 429');
        const retryAfter = Number(resp.headers?.['retry-after']) || 6;
        await sleep(Math.min(60, Math.max(1, retryAfter)) * 1000 + 250);
        continue;
      }
      if (resp.status === 401 || resp.status === 403) throw new HibpError('auth', `HIBP ${resp.status}`);
      if (resp.status < 200 || resp.status >= 300 || !Array.isArray(resp.data)) {
        throw new HibpError('upstream', `HIBP ${resp.status}`);
      }
      return (resp.data as any[]).map((b) => {
        const dataClasses: string[] = b.DataClasses ?? [];
        return {
          name: b.Name || b.Title || 'Unknown breach',
          severity: BreachService.severityFor(dataClasses),
          exposed: dataClasses,
          date: b.BreachDate || b.AddedDate || new Date().toISOString().slice(0, 10),
        };
      });
    }
    throw new HibpError('rate_limited', 'HIBP 429');
  }

  /**
   * LeakCheck Public API：GET /api/public?check=email
   *  - 命中：{ success: true, found, fields: [...合并后的数据类型], sources: [{ name, date: 'YYYY-MM' }] }
   *  - 未命中：{ success: false, error: 'Not found' }（HTTP 200）
   *  fields 是该邮箱在所有来源里合计暴露过的数据类型，不是逐条来源的；每条告警都挂这份合并列表，界面上按「合计」表述。
   */
  private async queryLeakCheck(email: string, maxRetries = 3): Promise<{
    breaches: Array<{ name: string; severity: 'low' | 'medium' | 'high'; exposed: string[]; date: string }>;
    exposedSummary: string[];
  }> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let resp;
      try {
        resp = await axios.get(LEAKCHECK_PUBLIC_URL, {
          params: { check: email },
          headers: { 'User-Agent': 'StarLensAI-BreachMonitor' },
          // 用户操作路径（maxRetries=1）缩短超时，避免拖过客户端超时
          timeout: maxRetries <= 1 ? 8000 : 15000,
          validateStatus: () => true,
        });
      } catch (err: any) {
        throw new HibpError('upstream', err?.message || 'network error');
      }
      const body = resp.data ?? {};
      const errText = String(body?.error ?? '').toLowerCase();
      if (resp.status === 429 || errText.includes('limit') || errText.includes('too many')) {
        if (attempt >= maxRetries) throw new HibpError('rate_limited', `LeakCheck ${resp.status} ${errText}`);
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (resp.status === 200 && body?.success === false && errText.includes('not found')) {
        return { breaches: [], exposedSummary: [] };
      }
      if (errText.includes('invalid')) throw new HibpError('invalid_email', `LeakCheck ${errText}`);
      if (resp.status !== 200 || body?.success !== true || !Array.isArray(body?.sources)) {
        throw new HibpError('upstream', `LeakCheck ${resp.status} ${errText || 'bad response'}`);
      }
      // 合计数据类型单独存（目标详情页展示一次）；每条告警只写确定泄露的「邮箱」，等级统一 medium
      const exposedSummary = BreachService.leakCheckFieldsToClasses(Array.isArray(body.fields) ? body.fields : []);
      const exposed = ['Email addresses'];
      const severity: 'medium' = 'medium';
      const seen = new Set<string>();
      const breaches = (body.sources as any[])
        .filter((src) => src?.name && !seen.has(src.name) && seen.add(src.name))
        .map((src) => {
          // 没有日期的来源不编一个（原来填当天，像是「今天刚泄露」）
          const d = typeof src.date === 'string' && /^\d{4}-\d{2}/.test(src.date) ? `${src.date.slice(0, 7)}-01` : '';
          return { name: String(src.name).slice(0, 190), severity, exposed, date: d };
        });
      return { breaches, exposedSummary };
    }
    throw new HibpError('rate_limited', 'LeakCheck rate limited');
  }

  /** LeakCheck 字段名 → 与 HIBP 一致的可读数据类型（便于共用 severityFor 与界面展示） */
  static leakCheckFieldsToClasses(fields: string[]): string[] {
    const map: Record<string, string> = {
      password: 'Passwords', ssn: 'Social security numbers', dob: 'Dates of birth',
      phone: 'Phone numbers', address: 'Physical addresses', city: 'Geographic locations', state: 'Geographic locations',
      zip: 'Geographic locations', country: 'Geographic locations', ip: 'IP addresses', ip1: 'IP addresses', ip2: 'IP addresses',
      name: 'Names', first_name: 'Names', last_name: 'Names', middle_name: 'Names', profile_name: 'Names',
      username: 'Usernames', gender: 'Genders', company_name: 'Employers',
    };
    const out = new Set<string>(['Email addresses']);
    for (const f of fields) {
      const k = String(f).toLowerCase();
      if (map[k]) out.add(map[k]);
    }
    return Array.from(out);
  }

  /**
   * 严重度按 HIBP DataClasses 精确匹配（原来 includes('address') 会命中每条泄露都带的 "Email addresses"，全部成了中风险）
   */
  static severityFor(dataClasses: string[]): 'low' | 'medium' | 'high' {
    const set = new Set(dataClasses.map((d) => d.toLowerCase().trim()));
    const has = (...xs: string[]) => xs.some((x) => set.has(x));
    if (has('passwords', 'historical passwords', 'password hints', 'medical records', 'health insurance information', 'sexual orientations', 'private messages', 'credit cards', 'credit card cvv', 'partial credit card data', 'bank account numbers',
      'social security numbers', 'government issued ids', 'passport numbers', 'financial transactions', 'security questions and answers', 'auth tokens', 'pins')) {
      return 'high';
    }
    if (has('names', 'phone numbers', 'physical addresses', 'dates of birth', 'geographic locations', 'ip addresses', 'genders', 'employers', 'home ownership statuses', 'family members', 'partial dates of birth', 'physical attributes', 'job titles')) {
      return 'medium';
    }
    return 'low';
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

  /** 每天 03:00 UTC 扫描全部已验证目标；按 HIBP_RPM 限速，避免批量 429 被当成「无泄露」 */
  @Cron('0 3 * * *', { name: 'breach-daily-scan' })
  async runDailyScan() {
    const start = Date.now();
    let locked = false;
    this.logger.log('[BreachCron] start daily scan');
    this.logger.log(`[BreachCron] provider=${breachProvider()}`);
    try {
      // 多实例 / 部署重启时不重复跑；最久没扫的先扫，部署打断后下次从没扫到的开始
      locked = await this.redis.acquireLock(CRON_LOCK_KEY, 6 * 3600).catch(() => true);
      if (!locked) {
        this.logger.log('[BreachCron] another instance is running — skip');
        return;
      }
      const targets = await this.prisma.breachTarget.findMany({
        where: { verified: true },
        select: { id: true },
        orderBy: { lastScannedAt: { sort: 'asc', nulls: 'first' } },
      });
      const gapMs = Math.ceil(60000 / providerRpm()) + 200;
      let totalNew = 0;
      let failed = 0;
      for (const [i, t] of targets.entries()) {
        if (i > 0) await sleep(gapMs);
        try {
          const r = await this.scanTarget(t.id);
          totalNew += r.newAlerts;
          if (!r.ok) failed += 1;
        } catch (err: any) {
          // 单个目标的 DB 异常不能中断当天剩余目标
          failed += 1;
          this.logger.error(`[BreachCron] target=${t.id} failed: ${err?.message}`);
        }
      }
      const elapsed = Date.now() - start;
      this.logger.log(`[BreachCron] done in ${elapsed}ms scanned=${targets.length} failed=${failed} newAlerts=${totalNew}`);
    } catch (err: any) {
      this.logger.error(`[BreachCron] failed: ${err?.message}`, err?.stack);
    } finally {
      // 只释放自己拿到的锁（没拿到锁直接 return 时不能删掉别的实例的锁）
      if (locked) await this.redis.releaseLock(CRON_LOCK_KEY).catch(() => undefined);
    }
  }

  // ====================================================================
  // 内部工具
  // ====================================================================
  private unavailable(lang: Lang) {
    return new HttpException({
      message: tr(lang, '数据泄露监控暂时不可用，请稍后再试', 'Breach monitoring is temporarily unavailable. Please try again later.'),
      code: 'breach_unavailable',
    }, HttpStatus.SERVICE_UNAVAILABLE);
  }

  /** HMAC(BREACH_AES_KEY, targetId:code)：即使哈希泄露，没有服务端密钥也无法离线枚举 6 位码 */
  private hashCode(targetId: string, code: string): string {
    const key = getAesKey() ?? Buffer.from(HIBP_SALT_NAMESPACE);
    return createHmac('sha256', key).update(`${targetId}:${code}`).digest('hex');
  }

  /** 生成并发送验证码（冷却 60s、每用户每小时 10 封；Redis 不可用 fail closed） */
  private async issueCode(userId: string, targetId: string, email: string, lang: Lang) {
    // 邮件通道没配时一律拒绝（不依赖 NODE_ENV：MailService 未配置会把正文含验证码打进日志）；本地联调显式 BREACH_ALLOW_STUB=true
    if (!this.mail.isConfigured && process.env.BREACH_ALLOW_STUB !== 'true') {
      this.logger.error('[Breach] mail not configured — cannot send verification code');
      throw this.unavailable(lang);
    }
    let client: ReturnType<RedisService['getClient']>;
    try {
      client = this.redis.getClient();
      const ttl = await client.ttl(CODE_COOLDOWN_KEY + targetId);
      if (ttl > 0) {
        throw new HttpException({
          message: tr(lang, `发送太频繁，请 ${ttl} 秒后再试`, `Please wait ${ttl}s before requesting another code.`),
          code: 'breach_cooldown',
          retryAfterSeconds: ttl,
        }, HttpStatus.TOO_MANY_REQUESTS);
      }
      // 复核 P1：先读后扣 —— 原来每个计数都在判断前无条件 INCR，被拒绝的请求也扣全局额度，
      // 一个账号连发两分钟就能把全站当天的验证码额度耗光。现在只在确定要发送时才 INCR。
      const rcpt = createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
      const ymd = new Date().toISOString().slice(0, 10);
      const keys = {
        user: CODE_USER_QUOTA_KEY + userId,
        hour: CODE_RECIPIENT_HOUR_KEY + rcpt,
        day: CODE_RECIPIENT_DAY_KEY + rcpt,
        global: CODE_GLOBAL_DAY_KEY + ymd,
      };
      const [userN, hourN, dayN, globalN] = (await client.mget(keys.user, keys.hour, keys.day, keys.global)).map((v) => Number(v) || 0);
      const reject = async (message: string) => {
        // 被拒也写冷却：不让客户端绕过冷却持续打接口
        await client.set(CODE_COOLDOWN_KEY + targetId, '1', 'EX', CODE_RESEND_COOLDOWN_SEC).catch(() => undefined);
        throw new HttpException({ message, code: 'breach_code_quota' }, HttpStatus.TOO_MANY_REQUESTS);
      };
      if (userN >= CODE_MAX_SENDS_PER_USER_HOUR) {
        await reject(tr(lang, '验证码请求过多，请一小时后再试', 'Too many code requests. Please try again in an hour.'));
      }
      if (hourN >= CODE_MAX_PER_RECIPIENT_HOUR || dayN >= CODE_MAX_PER_RECIPIENT_DAY) {
        await reject(tr(lang, '这个邮箱收到的验证码太多了，请稍后再试', 'Too many codes have been sent to this email. Please try again later.'));
      }
      if (globalN >= CODE_MAX_GLOBAL_DAY) {
        this.logger.warn(`[Breach] global verification email cap reached (${CODE_MAX_GLOBAL_DAY}/day)`);
        await reject(tr(lang, '今天发送的验证码已达上限，请明天再试', 'Daily verification email limit reached. Please try again tomorrow.'));
      }
      const tx = client.multi();
      tx.incr(keys.user); tx.expire(keys.user, 3600);
      tx.incr(keys.hour); tx.expire(keys.hour, 3600);
      tx.incr(keys.day); tx.expire(keys.day, 86400);
      tx.incr(keys.global); tx.expire(keys.global, 2 * 86400);
      await tx.exec();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw this.unavailable(lang);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.breachTarget.update({
      where: { id: targetId },
      data: { verificationToken: this.hashCode(targetId, code), verificationExpiresAt: new Date(Date.now() + CODE_TTL_SEC * 1000) },
    });
    await client.del(CODE_ATTEMPTS_KEY + targetId).catch(() => undefined);
    await client.set(CODE_COOLDOWN_KEY + targetId, '1', 'EX', CODE_RESEND_COOLDOWN_SEC).catch(() => undefined);

    const en = lang !== 'zh';
    const subject = en ? `${code} is your StarLens AI breach monitoring code` : `${code} 是你的星识数据泄露监控验证码`;
    const text = en
      ? `Your verification code is ${code}. It expires in 30 minutes.\n\nSomeone (hopefully you) asked StarLens AI to monitor this email address for data breaches. If this wasn't you, ignore this email — nothing will be monitored.`
      : `你的验证码是 ${code}，30 分钟内有效。\n\n有人（应该是你）在星识安全助手里申请监控这个邮箱是否出现在数据泄露中。如果不是你本人操作，请忽略本邮件，我们不会监控这个邮箱。`;
    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#141A2B">
<p>${en ? 'Your verification code is' : '你的验证码是'}</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#2F6BFF">${code}</p>
<p>${en ? 'It expires in 30 minutes.' : '30 分钟内有效。'}</p>
<p style="color:#646C7C">${en
      ? "Someone (hopefully you) asked StarLens AI to monitor this email address for data breaches. If this wasn't you, ignore this email — nothing will be monitored."
      : '有人（应该是你）在星识安全助手里申请监控这个邮箱是否出现在数据泄露中。如果不是你本人操作，请忽略本邮件，我们不会监控这个邮箱。'}</p></div>`;
    const sent = await this.mail.send({ to: email, subject, text, html, tag: 'breach-verify' });
    if (!sent.delivered && this.mail.isConfigured) {
      await client.del(CODE_COOLDOWN_KEY + targetId).catch(() => undefined);
      throw new HttpException({
        message: tr(lang, '验证码发送失败，请稍后重试', 'Could not send the code. Please try again later.'),
        code: 'breach_send_failed',
      }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** 清掉本用户「未验证且验证码已过期」的目标（不占名额） */
  private async purgeExpiredPending(userId: string) {
    await this.prisma.breachTarget.deleteMany({
      where: { userId, verified: false, OR: [{ verificationExpiresAt: null }, { verificationExpiresAt: { lt: new Date() } }] },
    }).catch(() => undefined);
  }

  private async writeScanStatus(targetId: string, status: 'ok' | 'failed', reason?: ScanFailReason) {
    try {
      await this.redis.getClient().set(SCAN_STATUS_KEY + targetId, JSON.stringify({ status, reason: reason ?? null, at: Date.now() }), 'EX', SCAN_STATUS_TTL);
    } catch {
      /* Redis 不可用：列表回退到 lastScannedAt 判断 */
    }
  }

  private async readScanStatuses(ids: string[]): Promise<Map<string, { status: 'ok' | 'failed'; reason?: ScanFailReason }>> {
    const map = new Map<string, { status: 'ok' | 'failed'; reason?: ScanFailReason }>();
    if (!ids.length) return map;
    try {
      const vals = await this.redis.getClient().mget(ids.map((id) => SCAN_STATUS_KEY + id));
      vals.forEach((v, i) => {
        if (!v) return;
        try { map.set(ids[i], JSON.parse(v)); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
    return map;
  }

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
