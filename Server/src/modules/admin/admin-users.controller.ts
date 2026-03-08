import { Controller, Get, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminUsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('country') country?: string,
  ) {
    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const where: any = {};
    if (country) where.country = country;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: parseInt(pageSize, 10),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          email: true,
          country: true,
          avatar: true,
          nickname: true,
          gender: true,
          birthday: true,
          role: true,
          lastLogin: true,
          subscriptionStatus: true,
          subscriptionExpire: true,
          createdAt: true,
          subscriptions: { take: 1, orderBy: { expireTime: 'desc' } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    const pageNum = parseInt(page, 10);
    const size = parseInt(pageSize, 10);
    const itemsWithBirthday = (items as any[]).map((u) => ({
      ...u,
      birthday: u.birthday ? (u.birthday as Date).toISOString().slice(0, 10) : null,
    }));
    return { items: itemsWithBirthday, total, page: pageNum, pageSize: size };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        phone: true,
        email: true,
        country: true,
        avatar: true,
        nickname: true,
        gender: true,
        birthday: true,
        role: true,
        lastLogin: true,
        subscriptionStatus: true,
        subscriptionExpire: true,
        createdAt: true,
        subscriptions: { take: 1, orderBy: { expireTime: 'desc' } },
      },
    });
    const u = user as any;
    return {
      ...u,
      birthday: u.birthday ? (u.birthday as Date).toISOString().slice(0, 10) : null,
    };
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return { id, status, success: true };
  }

  /** 编辑用户资料：avatar, nickname, gender, birthday */
  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { avatar?: string; nickname?: string; gender?: string; birthday?: string },
  ) {
    const data: Record<string, unknown> = {};
    if (body.avatar !== undefined) data.avatar = body.avatar;
    if (body.nickname !== undefined) data.nickname = body.nickname;
    if (body.gender !== undefined) {
      const g = body.gender?.toLowerCase();
      (data as any).gender = g === 'male' || g === 'female' ? g : 'unknown';
    }
    if (body.birthday !== undefined) {
      if (body.birthday === null || body.birthday === '') {
        data.birthday = null;
      } else {
        const d = new Date(body.birthday);
        if (!isNaN(d.getTime())) (data as any).birthday = d;
      }
    }
    await this.prisma.user.update({
      where: { id },
      data: data as any,
    });
    return { success: true };
  }
}
