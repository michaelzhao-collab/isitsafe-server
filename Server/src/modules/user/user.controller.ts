import { Controller, Put, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private prisma: PrismaService) {}

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
}
