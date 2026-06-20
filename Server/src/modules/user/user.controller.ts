import {
  Controller,
  Put,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FamilyService } from '../family/family.service';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private prisma: PrismaService, private family: FamilyService) {}

  /**
   * 修改用户资料：avatar, nickname, gender, birthday
   * gender: male | female | unknown
   * birthday: YYYY-MM-DD 或 ISO 日期字符串
   */
  @Put('profile')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body()
    body: { avatar?: string; nickname?: string; gender?: string; birthday?: string } = {},
  ) {
    const b = body ?? {};
    const data: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(b, 'avatar')) data.avatar = b.avatar;
    if (Object.prototype.hasOwnProperty.call(b, 'nickname')) data.nickname = b.nickname;
    if (Object.prototype.hasOwnProperty.call(b, 'gender')) {
      const g = String(b.gender || '').toLowerCase();
      data.gender = g === 'male' || g === 'female' ? g : 'unknown';
    }
    if (Object.prototype.hasOwnProperty.call(b, 'birthday')) {
      const v = b.birthday;
      if (v === null || v === '') {
        data.birthday = null;
      } else {
        const d = new Date(String(v));
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('生日格式无效，请使用 YYYY-MM-DD');
        }
        data.birthday = d;
      }
    }
    if (Object.keys(data).length === 0) {
      return { success: true };
    }
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: data as any,
      });
    } catch (e: any) {
      console.error('[User] updateProfile error', e?.message, e);
      throw new BadRequestException(e?.message || '更新资料失败');
    }
    return { success: true };
  }

  /**
   * V3 心跳：用户主动打开 App 时上报（关怀机制核心依赖）
   * 客户端节流 5 分钟内一次即可
   *
   * POST /api/v3/user/heartbeat  body?: { trigger_source?: string }
   * 合法 trigger_source: cold_launch | foreground | universal_link | share_extension
   * push_tap 会被接受但不算"活跃"
   */
  @Post('v3/heartbeat')
  async heartbeat(
    @CurrentUser('sub') userId: string,
    @Body() body?: { trigger_source?: string; triggerSource?: string },
  ) {
    const source = body?.trigger_source ?? body?.triggerSource ?? 'foreground';
    return this.family.recordHeartbeat(userId, source);
  }

  /**
   * V3 长辈模式开关（自己开关）
   *
   * PUT /api/v3/user/elder-mode  body: { enabled: boolean }
   */
  @Put('v3/elder-mode')
  async setElderMode(
    @CurrentUser('sub') userId: string,
    @Body() body: { enabled?: boolean },
  ) {
    const enabled = !!body?.enabled;
    await this.prisma.user.update({
      where: { id: userId },
      data: { elderModeEnabled: enabled },
    });
    return { success: true, enabled };
  }

  /**
   * V3-S1-5 注册/更新推送设备 token
   *
   * POST /api/v3/user/devices
   * body: { deviceToken: string; platform: 'ios'|'android'; environment?: 'production'|'sandbox';
   *         appVersion?: string; locale?: string }
   *
   * 行为：
   *  - 同一 deviceToken 全局唯一；如果之前归属别人，归属迁移到当前用户
   *  - failureCount/lastFailureReason 重置（用户重新登录意味 token 重新有效）
   */
  @Post('v3/devices')
  async registerDevice(
    @CurrentUser('sub') userId: string,
    @Body()
    body: {
      deviceToken?: string;
      platform?: string;
      environment?: string;
      appVersion?: string;
      locale?: string;
    },
  ) {
    const deviceToken = (body?.deviceToken || '').trim();
    if (!deviceToken) throw new BadRequestException('deviceToken required');
    const platform = (body?.platform || 'ios').toLowerCase();
    if (!['ios', 'android'].includes(platform)) {
      throw new BadRequestException('platform must be ios|android');
    }
    const environment = (body?.environment || 'production').toLowerCase();
    if (!['production', 'sandbox'].includes(environment)) {
      throw new BadRequestException('environment must be production|sandbox');
    }

    await this.prisma.userDevice.upsert({
      where: { deviceToken },
      create: {
        userId,
        deviceToken,
        platform,
        environment,
        appVersion: body?.appVersion ?? null,
        locale: body?.locale ?? null,
      },
      update: {
        userId, // 归属迁移：同一设备换账号登录
        platform,
        environment,
        appVersion: body?.appVersion ?? null,
        locale: body?.locale ?? null,
        failureCount: 0,
        lastFailureReason: null,
        lastSeenAt: new Date(),
      },
    });

    return { success: true };
  }

  /**
   * V4 通知偏好
   *   - pushAllEnabled：总开关，false 时业务 push 全跳过
   *   - pushFamilyCareEnabled：家人不活跃提醒（family_care category）
   * 后续新增分类按需扩展，先这两个覆盖业主反馈
   */
  @Get('v3/notification-prefs')
  async getNotificationPrefs(@CurrentUser('sub') userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pushAllEnabled: true, pushFamilyCareEnabled: true },
    });
    return {
      pushAllEnabled: u?.pushAllEnabled ?? true,
      pushFamilyCareEnabled: u?.pushFamilyCareEnabled ?? true,
    };
  }

  @Put('v3/notification-prefs')
  async updateNotificationPrefs(
    @CurrentUser('sub') userId: string,
    @Body() body: { pushAllEnabled?: boolean; pushFamilyCareEnabled?: boolean } = {},
  ) {
    const data: Record<string, boolean> = {};
    if (typeof body?.pushAllEnabled === 'boolean') {
      data.pushAllEnabled = body.pushAllEnabled;
    }
    if (typeof body?.pushFamilyCareEnabled === 'boolean') {
      data.pushFamilyCareEnabled = body.pushFamilyCareEnabled;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field required');
    }
    const u = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { pushAllEnabled: true, pushFamilyCareEnabled: true },
    });
    return u;
  }
}
