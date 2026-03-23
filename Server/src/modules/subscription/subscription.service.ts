import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Subscription } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPublicKey } from 'crypto';
import axios from 'axios';
import * as nodeJwt from 'jsonwebtoken';

type PaymentMethod = 'Apple' | 'Google';

type AppleTransactionPayload = {
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  expiresDate?: string | number;
  purchaseDate?: string | number;
  revocationDate?: string | number;
  environment?: string;
};

type AppleNotificationPayload = {
  notificationType?: string;
  subtype?: string;
  data?: {
    environment?: string;
    signedTransactionInfo?: string;
  };
};

type AppleJwk = {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
};

function planTypeFromProductId(productId: string): 'weekly' | 'monthly' | 'yearly' {
  const id = (productId || '').toLowerCase();
  if (id.includes('week')) return 'weekly';
  if (id.includes('year')) return 'yearly';
  return 'monthly';
}

function computeExpireTime(productId: string): Date {
  const now = new Date();
  const plan = planTypeFromProductId(productId);
  const exp = new Date(now);
  if (plan === 'weekly') exp.setDate(exp.getDate() + 7);
  else if (plan === 'yearly') exp.setFullYear(exp.getFullYear() + 1);
  else exp.setMonth(exp.getMonth() + 1);
  return exp;
}

function parseDate(v: unknown): Date | null {
  if (v == null) return null;
  if (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v))) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function decodeJWTPayload(token: string): Record<string, any> | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function extractAppleTransactionPayload(signed: string): AppleTransactionPayload {
  const p = decodeJWTPayload(signed) || {};
  return {
    productId: p.productId ?? p.product_id,
    transactionId: p.transactionId ?? p.transaction_id,
    originalTransactionId: p.originalTransactionId ?? p.original_transaction_id,
    expiresDate: p.expiresDate ?? p.expires_date,
    purchaseDate: p.purchaseDate ?? p.purchase_date,
    revocationDate: p.revocationDate ?? p.revocation_date,
    environment: p.environment,
  };
}

function appendHistory(
  historyLog: Prisma.JsonValue | null,
  entry: Record<string, unknown>,
): Prisma.InputJsonValue {
  const arr = Array.isArray(historyLog) ? [...historyLog] : [];
  arr.push(entry as Prisma.JsonObject);
  return arr as Prisma.InputJsonValue;
}

@Injectable()
export class SubscriptionService {
  private appleKeysCache: { at: number; keys: AppleJwk[] } | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get appleBundleId() {
    return (
      this.config.get('APPLE_BUNDLE_ID') ||
      this.config.get('IOS_BUNDLE_ID') ||
      this.config.get('APP_BUNDLE_ID') ||
      ''
    );
  }

  private get verifyAppleSignedPayload() {
    const raw = (this.config.get('APPLE_VERIFY_SIGNED_PAYLOAD', 'true') || '').toLowerCase();
    return !['0', 'false', 'off', 'no'].includes(raw);
  }

  private async recomputeUserSubscription(userId: string) {
    const now = new Date();
    await this.prisma.subscription.updateMany({
      where: {
        userId,
        status: 'active',
        expireTime: { lte: now },
      },
      data: { status: 'expired' },
    });

    const valid = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        expireTime: { gt: now },
      },
      orderBy: { expireTime: 'desc' },
    });

    if (valid) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'premium',
          subscriptionExpire: valid.expireTime,
        },
      });
      return {
        active: true,
        expireTime: valid.expireTime,
        productId: valid.productId,
        status: valid.status,
        isPremium: true,
        planType: valid.planType,
      };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'free',
        subscriptionExpire: null,
      },
    });
    return {
      active: false,
      expireTime: null,
      productId: null,
      status: 'expired',
      isPremium: false,
      planType: null,
    };
  }

  private async upsertSubscriptionForUser(
    userId: string,
    input: {
      productId: string;
      transactionId?: string | null;
      originalTransactionId?: string | null;
      expireTime: Date;
      status: string;
      paymentMethod: PaymentMethod;
      environment?: string | null;
      lastEventType?: string | null;
      refundedAt?: Date | null;
      revokedAt?: Date | null;
      purchaseDate?: Date | null;
      historyEntry: Record<string, unknown>;
    },
  ): Promise<Subscription> {
    const now = new Date();
    const whereCandidate = input.transactionId
      ? await this.prisma.subscription.findFirst({ where: { transactionId: input.transactionId } })
      : null;

    const existing =
      whereCandidate ||
      (input.originalTransactionId
        ? await this.prisma.subscription.findFirst({
            where: {
              OR: [
                { originalTransactionId: input.originalTransactionId },
                { transactionId: input.originalTransactionId },
                { latestTransactionId: input.originalTransactionId },
              ],
            },
            orderBy: { updatedAt: 'desc' },
          })
        : await this.prisma.subscription.findFirst({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
          }));

    const data: Prisma.SubscriptionUncheckedCreateInput = {
      userId,
      productId: input.productId,
      planType: planTypeFromProductId(input.productId),
      status: input.status,
      expireTime: input.expireTime,
      transactionId: input.transactionId ?? undefined,
      originalTransactionId: input.originalTransactionId ?? undefined,
      latestTransactionId: input.transactionId ?? undefined,
      environment: input.environment ?? undefined,
      lastEventType: input.lastEventType ?? undefined,
      refundedAt: input.refundedAt ?? undefined,
      revokedAt: input.revokedAt ?? undefined,
      purchaseTime: input.purchaseDate ?? undefined,
      autoRenewStatus: input.status === 'active',
      paymentMethod: input.paymentMethod,
      historyLog: [
        {
          at: now.toISOString(),
          ...input.historyEntry,
        },
      ],
    };

    if (!existing) {
      return this.prisma.subscription.create({ data });
    }

    return this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        // 允许同一 Apple 订阅在“当前登录账号”下生效，避免切换账号后 status 仍落在旧账号
        userId,
        productId: data.productId,
        planType: data.planType,
        status: data.status,
        expireTime: data.expireTime,
        transactionId: data.transactionId,
        originalTransactionId: data.originalTransactionId ?? existing.originalTransactionId ?? undefined,
        latestTransactionId: data.latestTransactionId,
        environment: data.environment,
        lastEventType: data.lastEventType,
        refundedAt: data.refundedAt,
        revokedAt: data.revokedAt,
        purchaseTime: data.purchaseTime ?? existing.purchaseTime,
        autoRenewStatus: data.autoRenewStatus,
        paymentMethod: data.paymentMethod,
        historyLog: appendHistory(existing.historyLog as Prisma.JsonValue, {
          at: now.toISOString(),
          ...input.historyEntry,
        }),
      },
    });
  }

  private async getAppleJwks(): Promise<AppleJwk[]> {
    const now = Date.now();
    if (this.appleKeysCache && now - this.appleKeysCache.at < 6 * 60 * 60 * 1000) {
      return this.appleKeysCache.keys;
    }
    const resp = await axios.get<{ keys: AppleJwk[] }>(
      'https://appleid.apple.com/auth/keys',
      { timeout: 5000 },
    );
    const keys = Array.isArray(resp.data?.keys) ? resp.data.keys : [];
    if (!keys.length) throw new UnauthorizedException('Apple keys unavailable');
    this.appleKeysCache = { at: now, keys };
    return keys;
  }

  private async verifyAppleSignedJws(token: string): Promise<Record<string, any>> {
    if (!this.verifyAppleSignedPayload) {
      const decoded = decodeJWTPayload(token);
      if (!decoded) throw new UnauthorizedException('Invalid Apple signed payload');
      return decoded;
    }

    const bundleId = this.appleBundleId;
    if (!bundleId) {
      throw new UnauthorizedException('APPLE_BUNDLE_ID is not configured');
    }
    const decoded = nodeJwt.decode(token, { complete: true }) as
      | { header?: { kid?: string; alg?: string } }
      | null;
    const kid = decoded?.header?.kid;
    const alg = decoded?.header?.alg;
    if (!kid || alg !== 'RS256') {
      throw new UnauthorizedException('Invalid Apple signed payload header');
    }

    const keys = await this.getAppleJwks();
    const jwk = keys.find((k) => k.kid === kid && k.alg === 'RS256');
    if (!jwk) throw new UnauthorizedException('Apple key not found');
    const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' });

    try {
      const payload = nodeJwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: 'appstoreconnect-v1',
        audience: bundleId,
      }) as Record<string, any>;
      return payload;
    } catch (firstErr: any) {
      // 某些通知载荷不带 aud，降级为仅校验签名与 issuer
      try {
        const payload = nodeJwt.verify(token, publicKey, {
          algorithms: ['RS256'],
          issuer: 'appstoreconnect-v1',
        }) as Record<string, any>;
        return payload;
      } catch (fallbackErr: any) {
        const header = (nodeJwt.decode(token, { complete: true }) as any)?.header || {};
        console.warn('[APPLE_JWS_VERIFY_FAILED]', {
          kid: header.kid,
          alg: header.alg,
          first: firstErr?.message,
          fallback: fallbackErr?.message,
        });
        throw new UnauthorizedException('Apple signed payload verification failed');
      }
    }
  }

  /**
   * 处理 Apple App Store Server Notifications V2 回调。
   * 无宽限期：到期即降级；退款/撤销即降级。
   */
  async handleAppleNotification(body: Record<string, unknown>): Promise<void> {
    const signedPayload = (body?.signedPayload as string) || (body?.signed_payload as string) || '';
    if (!signedPayload) return;

    let payload: AppleNotificationPayload;
    try {
      payload = (await this.verifyAppleSignedJws(signedPayload)) as AppleNotificationPayload;
    } catch (e: any) {
      console.warn('[APPLE_NOTIFICATION_INVALID_SIGNATURE]', {
        message: e?.message,
      });
      return;
    }
    const notificationType = payload.notificationType || 'UNKNOWN';
    const subtype = payload.subtype || null;
    const signedTxn = payload.data?.signedTransactionInfo;
    if (!signedTxn) return;

    let txnPayload: Record<string, any>;
    try {
      txnPayload = await this.verifyAppleSignedJws(signedTxn);
    } catch (e: any) {
      console.warn('[APPLE_TRANSACTION_INVALID_SIGNATURE]', {
        message: e?.message,
        notificationType,
      });
      return;
    }
    const txn = {
      ...extractAppleTransactionPayload(signedTxn),
      productId: (txnPayload.productId ?? txnPayload.product_id) || undefined,
      transactionId: (txnPayload.transactionId ?? txnPayload.transaction_id) || undefined,
      originalTransactionId:
        (txnPayload.originalTransactionId ?? txnPayload.original_transaction_id) || undefined,
      expiresDate: txnPayload.expiresDate ?? txnPayload.expires_date,
      purchaseDate: txnPayload.purchaseDate ?? txnPayload.purchase_date,
      revocationDate: txnPayload.revocationDate ?? txnPayload.revocation_date,
      environment: txnPayload.environment,
    };
    const txId = txn.transactionId || null;
    const originId = txn.originalTransactionId || null;

    const existing = await this.prisma.subscription.findFirst({
      where: {
        OR: [
          ...(txId ? [{ transactionId: txId }] : []),
          ...(originId ? [{ originalTransactionId: originId }, { latestTransactionId: originId }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!existing) {
      console.log('[APPLE_NOTIFICATION] skip (subscription not found)', {
        notificationType,
        subtype,
        txId,
        originId,
      });
      return;
    }

    const expireTime = parseDate(txn.expiresDate) || existing.expireTime;
    const revokedAt = parseDate(txn.revocationDate);

    let status = existing.status;
    if (notificationType === 'REFUND') status = 'refunded';
    else if (notificationType === 'REVOKE') status = 'revoked';
    else if (notificationType === 'EXPIRED') status = 'expired';
    else if (revokedAt) status = 'revoked';
    else if (expireTime <= new Date()) status = 'expired';
    else status = 'active';

    await this.upsertSubscriptionForUser(existing.userId, {
      productId: txn.productId || existing.productId,
      transactionId: txId,
      originalTransactionId: originId,
      expireTime,
      status,
      paymentMethod: 'Apple',
      environment: txn.environment || payload.data?.environment || existing.environment,
      lastEventType: subtype ? `${notificationType}:${subtype}` : notificationType,
      refundedAt: notificationType === 'REFUND' ? new Date() : undefined,
      revokedAt: status === 'revoked' ? revokedAt || new Date() : undefined,
      purchaseDate: parseDate(txn.purchaseDate) || undefined,
      historyEntry: {
        action: 'apple_notification',
        notificationType,
        subtype,
        txId,
        originId,
      },
    });

    await this.recomputeUserSubscription(existing.userId);
  }

  async verify(
    userId: string,
    productId: string,
    receipt: string,
    paymentMethod: PaymentMethod,
    transactionId?: string,
  ) {
    let finalProductId = productId;
    let finalTransactionId = transactionId || null;
    let originalTransactionId: string | null = null;
    let expireTime: Date | null = null;
    let environment: string | null = null;
    let purchaseDate: Date | null = null;
    let status = 'active';

    if (paymentMethod === 'Apple' && receipt) {
      let txnPayload: Record<string, any>;
      try {
        txnPayload = await this.verifyAppleSignedJws(receipt);
      } catch (e: any) {
        console.warn('[SUBSCRIPTION_VERIFY_INVALID_SIGNATURE]', {
          message: e?.message,
          userId,
          productId,
        });
        throw new UnauthorizedException('Invalid Apple receipt signature');
      }
      const txn = {
        ...extractAppleTransactionPayload(receipt),
        productId: (txnPayload.productId ?? txnPayload.product_id) || undefined,
        transactionId: (txnPayload.transactionId ?? txnPayload.transaction_id) || undefined,
        originalTransactionId:
          (txnPayload.originalTransactionId ?? txnPayload.original_transaction_id) || undefined,
        expiresDate: txnPayload.expiresDate ?? txnPayload.expires_date,
        purchaseDate: txnPayload.purchaseDate ?? txnPayload.purchase_date,
        revocationDate: txnPayload.revocationDate ?? txnPayload.revocation_date,
        environment: txnPayload.environment,
      };
      finalProductId = txn.productId || productId;
      finalTransactionId = finalTransactionId || txn.transactionId || null;
      originalTransactionId = txn.originalTransactionId || null;
      expireTime = parseDate(txn.expiresDate);
      purchaseDate = parseDate(txn.purchaseDate);
      environment = txn.environment || null;
      if (parseDate(txn.revocationDate)) {
        status = 'revoked';
      }
    }

    const finalExpire = expireTime || computeExpireTime(finalProductId);
    if (finalExpire <= new Date() && status === 'active') {
      status = 'expired';
    }

    const sub = await this.upsertSubscriptionForUser(userId, {
      productId: finalProductId,
      transactionId: finalTransactionId,
      originalTransactionId,
      expireTime: finalExpire,
      status,
      paymentMethod,
      environment,
      lastEventType: 'verify',
      purchaseDate,
      historyEntry: {
        action: 'verify',
        productId: finalProductId,
        paymentMethod,
        transactionId: finalTransactionId,
        originalTransactionId,
      },
    });

    const statusView = await this.recomputeUserSubscription(userId);
    return { success: true, subscription: sub, status: statusView };
  }

  async getStatus(userId: string) {
    return this.recomputeUserSubscription(userId);
  }

  async refresh(userId: string) {
    return this.recomputeUserSubscription(userId);
  }

  async getLogs(limit = 100) {
    return this.prisma.subscription.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, phone: true, email: true, country: true } } },
    });
  }

  /** 管理后台：会员订单列表，分页，可选按状态筛选 */
  async listOrders(page = 1, pageSize = 20, status?: string) {
    const skip = (page - 1) * pageSize;
    const where = status && status !== 'all' ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          productId: true,
          planType: true,
          status: true,
          expireTime: true,
          transactionId: true,
          originalTransactionId: true,
          paymentMethod: true,
          environment: true,
          lastEventType: true,
          createdAt: true,
          user: { select: { id: true, phone: true, nickname: true, email: true } },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
