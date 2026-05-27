import {
  Controller,
  Put,
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
   * POST /api/v3/user/heartbeat
   */
  @Post('v3/heartbeat')
  async heartbeat(@CurrentUser('sub') userId: string) {
    return this.family.recordHeartbeat(userId);
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
}
