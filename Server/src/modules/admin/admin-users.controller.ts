import { Controller, Get, Post, Put, Param, Query, Body, UseGuards, ForbiddenException, Req } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAuditLogService } from './audit/audit-log.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminUsersController {
  constructor(
    private prisma: PrismaService,
    private audit: AdminAuditLogService,
  ) {}

  /**
   * 批量回填历史 country 为空的用户
   * - 通过查 user.id 拿不到 IP（IP 不存档），只能用 phone 前缀兜底（已注册时部分写过）
   * - 仅在 user.country 为空时回填；不覆盖已有值
   * - 用 phone E.164 前缀映射常见国家
   *
   * 注意：本接口只能补 phone 前缀能推断的（+86→CN / +1→US / +44→GB ...）
   * 其他渠道（email/Apple）注册的用户必须等下次登录由 GeoIpService 实时补写
   */
  @Post('backfill-country')
  async backfillCountry() {
    const PHONE_PREFIX_MAP: Array<{ prefix: string; country: string }> = [
      { prefix: '+86', country: 'CN' },
      { prefix: '+1', country: 'US' },
      { prefix: '+44', country: 'GB' },
      { prefix: '+81', country: 'JP' },
      { prefix: '+82', country: 'KR' },
      { prefix: '+852', country: 'HK' },
      { prefix: '+853', country: 'MO' },
      { prefix: '+886', country: 'TW' },
      { prefix: '+65', country: 'SG' },
      { prefix: '+60', country: 'MY' },
      { prefix: '+61', country: 'AU' },
      { prefix: '+49', country: 'DE' },
      { prefix: '+33', country: 'FR' },
      { prefix: '+39', country: 'IT' },
      { prefix: '+34', country: 'ES' },
      { prefix: '+7', country: 'RU' },
      { prefix: '+91', country: 'IN' },
      { prefix: '+62', country: 'ID' },
      { prefix: '+84', country: 'VN' },
      { prefix: '+66', country: 'TH' },
      { prefix: '+63', country: 'PH' },
      { prefix: '+55', country: 'BR' },
      { prefix: '+52', country: 'MX' },
    ];

    const candidates = await this.prisma.user.findMany({
      where: { country: null, phone: { not: null } },
      select: { id: true, phone: true },
      take: 5000,
    });

    let updated = 0;
    for (const u of candidates) {
      if (!u.phone) continue;
      const hit = PHONE_PREFIX_MAP.find((m) => u.phone!.startsWith(m.prefix));
      if (!hit) continue;
      try {
        await this.prisma.user.update({
          where: { id: u.id },
          data: { country: hit.country },
        });
        updated++;
      } catch {
        // ignore
      }
    }

    const stillEmpty = await this.prisma.user.count({ where: { country: null } });
    return {
      scanned: candidates.length,
      updated,
      stillEmpty,
      hint: stillEmpty > 0
        ? `仍有 ${stillEmpty} 个用户 country 为空（多为非手机号注册的 email/Apple 用户）— 等他们下次登录会自动补写`
        : '✓ 所有用户已有国家信息',
    };
  }

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
    @Body('reason') reason: string | undefined,
    @Req() req: any,
  ) {
    if (id === operatorId) {
      throw new ForbiddenException('不能对自己执行禁用/解封操作');
    }
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isDisabled: true, disabledReason: true },
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
    // S3-7：审计日志落表（取代原 console.log）
    await this.audit.record({
      adminId: operatorId,
      action: disable ? 'user.disable' : 'user.enable',
      targetType: 'user',
      targetId: id,
      before: { isDisabled: target.isDisabled, disabledReason: target.disabledReason },
      after: { isDisabled: disable, disabledReason: disable ? (reason ?? null) : null },
      req,
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
