import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationService } from '../notification/notification.service';

/**
 * V4-P2 admin 推送管理
 *
 * 入口：admin 后台「消息/数据 → 推送通知」
 * 路由：/admin/push/*
 *
 * 全部要求 admin 角色（JwtAuthGuard + AdminRoleGuard）。
 */
export class SendPushDto {
  @IsIn(['all', 'user'])
  audience!: 'all' | 'user';

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  @MaxLength(800)
  body!: string;
}

@Controller('admin/push')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminPushController {
  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
  ) {}

  /**
   * 预览：广播/单点将命中多少设备
   * GET /admin/push/preview-audience?audience=all
   * GET /admin/push/preview-audience?audience=user&targetUserId=xxx
   */
  @Get('preview-audience')
  async previewAudience(
    @Query('audience') audience: 'all' | 'user',
    @Query('targetUserId') targetUserId?: string,
  ) {
    if (audience === 'user') {
      if (!targetUserId) throw new BadRequestException('targetUserId required');
      const user = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, nickname: true, phone: true, email: true },
      });
      if (!user) return { audience, usersCount: 0, devicesCount: 0, user: null };
      const devicesCount = await this.prisma.userDevice.count({
        where: { userId: targetUserId, platform: 'ios', failureCount: { lt: 5 } },
      });
      return { audience, usersCount: 1, devicesCount, user };
    }
    // all: 统计活跃 iOS 设备数 + 对应用户数
    const [devicesCount, distinctUsers] = await Promise.all([
      this.prisma.userDevice.count({
        where: { platform: 'ios', failureCount: { lt: 5 } },
      }),
      this.prisma.userDevice.groupBy({
        by: ['userId'],
        where: { platform: 'ios', failureCount: { lt: 5 } },
      }),
    ]);
    return { audience, usersCount: distinctUsers.length, devicesCount };
  }

  /**
   * 发送推送
   * POST /admin/push/send
   * body: { audience: 'all'|'user', targetUserId?, title, body }
   *
   * 同步执行：直接 await 全部投递完成后返回汇总。
   * （未来如果广播规模 > 1k 用户，应改异步 + 进度查询。当前规模够用。）
   */
  @Post('send')
  async send(@CurrentUser('sub') adminUserId: string, @Body() dto: SendPushDto) {
    if (dto.audience === 'user' && !dto.targetUserId) {
      throw new BadRequestException('targetUserId required when audience=user');
    }

    // 取候选 userId 列表
    let userIds: string[] = [];
    if (dto.audience === 'user') {
      userIds = [dto.targetUserId!];
    } else {
      const grouped = await this.prisma.userDevice.groupBy({
        by: ['userId'],
        where: { platform: 'ios', failureCount: { lt: 5 } },
      });
      userIds = grouped.map((g) => g.userId);
    }

    if (userIds.length === 0) {
      const record = await this.prisma.pushBroadcast.create({
        data: {
          audience: dto.audience,
          targetUserId: dto.targetUserId ?? null,
          title: dto.title,
          body: dto.body,
          devicesCount: 0,
          deliveredCount: 0,
          failedCount: 0,
          status: 'done',
          errorMessage: '无可推送的设备',
          sentByAdminId: adminUserId,
        },
      });
      return { ok: true, id: record.id, devicesCount: 0, deliveredCount: 0, failedCount: 0, hint: '无可推送的设备' };
    }

    // 总设备数（不是用户数）
    const devicesCount = await this.prisma.userDevice.count({
      where: { userId: { in: userIds }, platform: 'ios', failureCount: { lt: 5 } },
    });

    // 真正发送（按 userId 维度调用，每个 userId 内部会推所有该用户的设备）
    const sendResults = await Promise.allSettled(
      userIds.map((uid) =>
        this.notification.sendPush({
          userId: uid,
          title: dto.title,
          body: dto.body,
          category: 'admin_broadcast',
        }),
      ),
    );
    let deliveredCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    for (const r of sendResults) {
      if (r.status === 'fulfilled' && r.value.delivered) {
        deliveredCount++;
      } else {
        failedCount++;
        if (r.status === 'fulfilled' && r.value.reason) errors.push(r.value.reason);
        else if (r.status === 'rejected') errors.push(String(r.reason).slice(0, 100));
      }
    }
    const errorMessage = errors.length
      ? Array.from(new Set(errors)).slice(0, 3).join(' | ').slice(0, 500)
      : null;

    const record = await this.prisma.pushBroadcast.create({
      data: {
        audience: dto.audience,
        targetUserId: dto.targetUserId ?? null,
        title: dto.title,
        body: dto.body,
        devicesCount,
        deliveredCount,
        failedCount,
        status: deliveredCount > 0 ? 'done' : 'failed',
        errorMessage,
        sentByAdminId: adminUserId,
      },
    });

    return {
      ok: deliveredCount > 0,
      id: record.id,
      audience: dto.audience,
      devicesCount,
      deliveredCount,
      failedCount,
      errorMessage,
    };
  }

  /**
   * 推送历史
   * GET /admin/push/history?page=1&pageSize=20
   */
  @Get('history')
  async history(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const [items, total] = await Promise.all([
      this.prisma.pushBroadcast.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.pushBroadcast.count(),
    ]);

    // 补充目标用户与发起 admin 的展示名（避免前端再 N+1）
    const userIds = Array.from(
      new Set(
        items.flatMap((it) => [it.targetUserId, it.sentByAdminId].filter(Boolean) as string[]),
      ),
    );
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nickname: true, phone: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      items: items.map((it) => ({
        ...it,
        targetUser: it.targetUserId ? userMap.get(it.targetUserId) ?? null : null,
        sentByAdmin: userMap.get(it.sentByAdminId) ?? null,
      })),
      total,
      page: p,
      pageSize: ps,
    };
  }
}
