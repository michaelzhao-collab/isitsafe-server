import { Controller, Put, Body, UseGuards } from '@nestjs/common';
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
   * birthday: YYYY-MM-DD
   */
  @Put('profile')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body()
    body: { avatar?: string; nickname?: string; gender?: string; birthday?: string },
  ) {
    const data: Record<string, unknown> = {};
    if (body.avatar !== undefined) data.avatar = body.avatar;
    if (body.nickname !== undefined) data.nickname = body.nickname;
    if (body.gender !== undefined) {
      const g = body.gender?.toLowerCase();
      data.gender = g === 'male' || g === 'female' ? g : 'unknown';
    }
    if (body.birthday !== undefined) {
      if (body.birthday === null || body.birthday === '') {
        data.birthday = null;
      } else {
        const d = new Date(body.birthday);
        if (!isNaN(d.getTime())) data.birthday = d;
      }
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: data as any,
    });
    return { success: true };
  }
}
