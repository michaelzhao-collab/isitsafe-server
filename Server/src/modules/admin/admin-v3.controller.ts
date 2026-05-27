import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

/**
 * V3 一期 admin 后台只读 + 简单管理接口
 *  - /admin/v3/family/groups       家庭组列表
 *  - /admin/v3/family/broadcasts   广播流水
 *  - /admin/v3/family/care-notices 关怀通知流水
 *  - /admin/v3/elder/users         长辈模式用户
 *  - /admin/v3/elder/users/:id/toggle  PUT 切换
 *  - /admin/v3/deepfake/checks     语音深伪检测任务
 *  - /admin/v3/deepfake/stats      Provider 统计
 *  - /admin/v3/breach/targets      暗网监控目标
 *  - /admin/v3/breach/alerts       告警流水
 */
@Controller('admin/v3')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminV3Controller {
  constructor(private prisma: PrismaService) {}

  // ====================================================================
  // E 家庭守护
  // ====================================================================
  @Get('family/groups')
  async familyGroups(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('keyword') keyword?: string,
  ) {
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    const where: any = {};
    if (keyword?.trim()) {
      where.OR = [
        { name: { contains: keyword.trim(), mode: 'insensitive' } },
        { inviteCode: { contains: keyword.trim().toUpperCase() } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.familyGroup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        include: {
          owner: { select: { id: true, nickname: true, phone: true } },
          _count: { select: { members: true, broadcasts: true } },
        },
      }),
      this.prisma.familyGroup.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Get('family/broadcasts')
  async familyBroadcasts(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('groupId') groupId?: string,
  ) {
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    const where: any = {};
    if (groupId) where.groupId = groupId;
    const [items, total] = await Promise.all([
      this.prisma.familyBroadcast.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        // 注意：triggeredByUserId 不返回前端用户，但 admin 后台需要看（用于反诈骗审计）
        select: {
          id: true,
          groupId: true,
          triggeredByUserId: true,
          contentType: true,
          contentDisplay: true,
          resultLabel: true,
          source: true,
          createdAt: true,
        },
      }),
      this.prisma.familyBroadcast.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Get('family/care-notices')
  async familyCareNotices(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    const [items, total] = await Promise.all([
      this.prisma.familyCareNotice.findMany({
        orderBy: { sentAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.familyCareNotice.count(),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  // ====================================================================
  // J 长辈模式
  // ====================================================================
  @Get('elder/users')
  async elderUsers(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('enabled') enabled?: string,
    @Query('keyword') keyword?: string,
  ) {
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    const where: any = {};
    if (enabled === 'true') where.elderModeEnabled = true;
    if (enabled === 'false') where.elderModeEnabled = false;
    if (keyword?.trim()) {
      const kw = keyword.trim();
      where.OR = [
        { phone: { contains: kw } },
        { email: { contains: kw, mode: 'insensitive' } },
        { nickname: { contains: kw, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        select: {
          id: true,
          phone: true,
          email: true,
          nickname: true,
          elderModeEnabled: true,
          familyGroupId: true,
          lastActiveAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Put('elder/users/:id/toggle')
  async toggleElderMode(
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
  ) {
    await this.prisma.user.update({
      where: { id },
      data: { elderModeEnabled: !!enabled },
    });
    return { success: true, id, elderModeEnabled: !!enabled };
  }

  // ====================================================================
  // A1 语音深伪
  // ====================================================================
  @Get('deepfake/checks')
  async deepfakeChecks(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: string,
    @Query('label') label?: string,
  ) {
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    const where: any = {};
    if (status) where.status = status;
    if (label) where.resultLabel = label;
    const [items, total] = await Promise.all([
      this.prisma.deepfakeCheck.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        select: {
          id: true,
          userId: true,
          sourceType: true,
          fileDurationSec: true,
          resultScore: true,
          resultLabel: true,
          aiProvider: true,
          status: true,
          createdAt: true,
          completedAt: true,
          userFeedback: true,
        },
      }),
      this.prisma.deepfakeCheck.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Get('deepfake/stats')
  async deepfakeStats() {
    const [total, byProvider, byLabel, byStatus, today] = await Promise.all([
      this.prisma.deepfakeCheck.count(),
      this.prisma.deepfakeCheck.groupBy({ by: ['aiProvider'], _count: { _all: true } }),
      this.prisma.deepfakeCheck.groupBy({ by: ['resultLabel'], _count: { _all: true } }),
      this.prisma.deepfakeCheck.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.deepfakeCheck.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);
    return {
      total,
      today,
      byProvider: byProvider.map((p) => ({ provider: p.aiProvider ?? 'unknown', count: p._count._all })),
      byLabel: byLabel.map((l) => ({ label: l.resultLabel ?? 'pending', count: l._count._all })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    };
  }

  // ====================================================================
  // F 暗网监控
  // ====================================================================
  @Get('breach/targets')
  async breachTargets(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('verified') verified?: string,
  ) {
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    const where: any = {};
    if (verified === 'true') where.verified = true;
    if (verified === 'false') where.verified = false;
    const [items, total] = await Promise.all([
      this.prisma.breachTarget.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        select: {
          id: true,
          userId: true,
          targetType: true,
          targetValueHash: true, // 脱敏字符串展示，不返回明文 / 不返回 encrypted
          verified: true,
          lastScannedAt: true,
          createdAt: true,
          _count: { select: { alerts: true } },
        },
      }),
      this.prisma.breachTarget.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  @Get('breach/alerts')
  async breachAlerts(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('severity') severity?: string,
    @Query('dismissed') dismissed?: string,
  ) {
    const p = parseInt(page, 10);
    const ps = parseInt(pageSize, 10);
    const where: any = {};
    if (severity) where.severity = severity;
    if (dismissed === 'true') where.dismissed = true;
    if (dismissed === 'false') where.dismissed = false;
    const [items, total] = await Promise.all([
      this.prisma.breachAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.breachAlert.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }
}
