import { Controller, Post, Get, Body, BadRequestException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Admin 诊断端点：用于上线后快速验证 Push / Apple webhook 是否打通。
 *
 * 全部要求 admin 角色。
 */
@Controller('admin/diagnostics')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminDiagnosticsController {
  constructor(
    private notification: NotificationService,
    private prisma: PrismaService,
  ) {}

  /**
   * 给指定 userId 发一条测试 APNs 推送。
   *
   * 用法：
   *   curl -X POST https://www.starlensai.com/api/admin/diagnostics/test-push \
   *     -H "Authorization: Bearer <ADMIN_TOKEN>" \
   *     -H "Content-Type: application/json" \
   *     -d '{"userId":"clxxx...", "title":"测试", "body":"如果你看到这条说明 APNs 打通"}'
   *
   * 返回：
   *   { ok, devicesCount, delivered, reason?, messageId?, env, apnsConfigured }
   */
  @Post('test-push')
  async testPush(
    @Body() body: { userId?: string; title?: string; body?: string },
  ) {
    const userId = (body?.userId || '').trim();
    if (!userId) throw new BadRequestException('userId required');

    const devices = await this.prisma.userDevice.findMany({
      where: { userId, platform: 'ios' },
      select: {
        id: true,
        environment: true,
        failureCount: true,
        lastFailureReason: true,
        appVersion: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    const apnsConfigured = !!(
      process.env.APNS_TEAM_ID &&
      process.env.APNS_KEY_ID &&
      process.env.APNS_AUTH_KEY &&
      process.env.APNS_BUNDLE_ID
    );

    if (!apnsConfigured) {
      return {
        ok: false,
        reason: 'apns_env_missing',
        apnsConfigured: false,
        missing: {
          APNS_TEAM_ID: !process.env.APNS_TEAM_ID,
          APNS_KEY_ID: !process.env.APNS_KEY_ID,
          APNS_AUTH_KEY: !process.env.APNS_AUTH_KEY,
          APNS_BUNDLE_ID: !process.env.APNS_BUNDLE_ID,
        },
        devicesCount: devices.length,
      };
    }

    if (devices.length === 0) {
      return {
        ok: false,
        reason: 'no_device',
        apnsConfigured: true,
        devicesCount: 0,
        hint: 'iOS 端登录后需要进入 App，让 AppDelegate 完成 APNs token 注册并 POST /api/v3/devices',
      };
    }

    const result = await this.notification.sendPush({
      userId,
      title: body?.title || 'StarLens 测试推送',
      body: body?.body || '如果你看到这条，说明 APNs Key 与设备 token 都正常。',
      category: 'diagnostics',
    });

    return {
      ok: result.delivered,
      delivered: result.delivered,
      reason: result.reason,
      messageId: result.messageId,
      apnsConfigured: true,
      devicesCount: devices.length,
      devices: devices.map((d) => ({
        id: d.id,
        env: d.environment,
        appVersion: d.appVersion,
        failureCount: d.failureCount,
        lastFailureReason: d.lastFailureReason,
        lastSeenAt: d.lastSeenAt,
      })),
    };
  }

  /**
   * 查询某用户最近的 Apple webhook 历史。
   *
   * 用法：
   *   GET /api/admin/diagnostics/apple-webhook-history?userId=clxxx
   *
   * 返回该用户 subscription 表的 historyLog 中 action='apple_notification' 的条目。
   */
  @Get('apple-webhook-history')
  async appleWebhookHistory(@Body() _body: unknown) {
    // 取最近 20 个有 historyLog 的订阅（按 updatedAt desc）
    const subs = await this.prisma.subscription.findMany({
      where: { paymentMethod: 'Apple' },
      select: {
        id: true,
        userId: true,
        status: true,
        lastEventType: true,
        productId: true,
        transactionId: true,
        originalTransactionId: true,
        expireTime: true,
        updatedAt: true,
        environment: true,
        historyLog: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return {
      ok: true,
      count: subs.length,
      items: subs.map((s) => ({
        id: s.id,
        userId: s.userId,
        status: s.status,
        lastEventType: s.lastEventType,
        productId: s.productId,
        transactionId: s.transactionId,
        originalTransactionId: s.originalTransactionId,
        expireTime: s.expireTime,
        environment: s.environment,
        updatedAt: s.updatedAt,
        appleEvents: Array.isArray(s.historyLog)
          ? (s.historyLog as any[])
              .filter((h) => h?.action === 'apple_notification')
              .slice(-5)
          : [],
      })),
    };
  }

  /**
   * 检查推送相关 env 是否全配。
   * 返回布尔，绝不返回 Key 内容（避免泄漏）。
   */
  @Get('push-config')
  pushConfig() {
    return {
      APNS_TEAM_ID: !!process.env.APNS_TEAM_ID,
      APNS_KEY_ID: !!process.env.APNS_KEY_ID,
      APNS_AUTH_KEY: !!process.env.APNS_AUTH_KEY,
      APNS_BUNDLE_ID: process.env.APNS_BUNDLE_ID || null,
      APNS_ENV: process.env.APNS_ENV || 'production',
      APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID || null,
      authKeyLength: process.env.APNS_AUTH_KEY?.length ?? 0,
      authKeyStartsWith: process.env.APNS_AUTH_KEY?.slice(0, 30) || null,
    };
  }
}
