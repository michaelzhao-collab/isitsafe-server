import { Controller, Get, Put, Param, Query, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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

  /**
   * 管理员禁用/解封用户
   * body: { status: 'disabled' | 'active', reason?: string }
   * - status='disabled' → isDisabled=true，所有 JWT 请求被 jwt-auth.guard 403 拦截（code=account_disabled）
   * - status='active'   → isDisabled=false 恢复
   * 安全：
   *  - 不能禁用 SUPERADMIN
   *  - ADMIN 只能禁用 USER，不能禁用另一个 ADMIN
   *  - 不能禁用自己
   */
  @Put(':id/status')
  async updateStatus(
    @CurrentUser('sub') operatorId: string,
    @CurrentUser('role') operatorRole: string,
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reason') reason?: string,
  ) {
    if (id === operatorId) {
      throw new ForbiddenException('不能对自己执行禁用/解封操作');
    }
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) {
      throw new ForbiddenException('用户不存在');
    }
    if (target.role === 'SUPERADMIN') {
      throw new ForbiddenException('不能禁用超级管理员');
    }
    if (target.role === 'ADMIN' && operatorRole !== 'SUPERADMIN') {
      throw new ForbiddenException('仅超级管理员可禁用 ADMIN 账号');
    }
    const disable = status === 'disabled' || status === 'banned';
    await this.prisma.user.update({
      where: { id },
      data: {
        isDisabled: disable,
        disabledAt: disable ? new Date() : null,
        disabledReason: disable ? (reason ?? null) : null,
      },
    });
    // 立即让 jwt-auth.guard 的缓存失效，避免最长 60s 延迟
    JwtAuthGuard.invalidateUser(id);
    // 操作审计（轻量级 console.log；后续可落表）
    console.log('[ADMIN_USER_STATUS_CHANGED]', {
      operator: operatorId,
      operatorRole,
      target: id,
      targetRole: target.role,
      action: disable ? 'disable' : 'enable',
      reason: reason ?? null,
      at: new Date().toISOString(),
    });
    return { id, status: disable ? 'disabled' : 'active', success: true };
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
