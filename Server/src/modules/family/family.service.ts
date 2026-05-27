import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { randomBytes, createHash } from 'crypto';

const MAX_FAMILY_MEMBERS = 5;
const INVITE_CODE_TTL_DAYS = 7;
const INVITE_CODE_MAX_USES = 4;

/**
 * V3-E 家庭守护服务
 *
 * 设计要点：
 *  - 创建家庭组完全免费，不带 Pro 权益
 *  - 加入家庭后查询配额仍按 V2 现有"5 次/天"（每人独立）
 *  - 官方广播 triggeredByUserId 仅服务端可见，DTO 强制 @Exclude
 *  - 心跳活跃只更新 user_activities 表，不写 last_active_at（避免高频写 user 表）
 *    last_active_at 由 user_activities 表派生（cron 每日同步或 service 读取时聚合）
 */
@Injectable()
export class FamilyService {
  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
  ) {}

  // ====================================================================
  // 心跳：用户主动打开 App 时上报
  // ====================================================================
  async recordHeartbeat(userId: string): Promise<{ active: boolean; todayCount: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    // upsert：今日已有记录则 increment，否则 insert
    const activity = await this.prisma.userActivity.upsert({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        date: today,
        activeCount: 1,
        firstActiveAt: now,
        lastActiveAt: now,
      },
      update: {
        activeCount: { increment: 1 },
        lastActiveAt: now,
      },
    });

    // 同步更新 user.last_active_at（用于快速查询，但不实时一致）
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: now },
    });

    return { active: true, todayCount: activity.activeCount };
  }

  // ====================================================================
  // 家庭组 CRUD
  // ====================================================================
  async createGroup(userId: string, name?: string) {
    // 一个用户只能加入一个家庭组
    const existing = await this.prisma.familyMember.findFirst({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('You are already in a family group. Leave it first.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1) 创建组
      const group = await tx.familyGroup.create({
        data: {
          ownerUserId: userId,
          name: name?.trim() || '我的家庭',
        },
      });

      // 2) owner 加入为成员
      await tx.familyMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'owner',
        },
      });

      // 3) 同步 user 表 family_group_id + user_level
      await tx.user.update({
        where: { id: userId },
        data: {
          familyGroupId: group.id,
          userLevel: 'family_owner',
        },
      });

      return group;
    });
  }

  async getMyGroup(userId: string) {
    const member = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: { group: { include: { members: { include: { user: true } } } } },
    });
    if (!member) return null;
    return this.composeGroupDto(member.group, userId);
  }

  async leaveGroup(userId: string) {
    const member = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: { group: true },
    });
    if (!member) throw new NotFoundException('Not in any family group');
    if (member.role === 'owner') {
      throw new ForbiddenException('Owner cannot leave; dissolve the group instead');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.delete({ where: { id: member.id } });
      await tx.user.update({
        where: { id: userId },
        data: { familyGroupId: null, userLevel: 'personal' },
      });
    });
  }

  async dissolveGroup(userId: string, groupId: string) {
    const group = await this.prisma.familyGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.ownerUserId !== userId) throw new ForbiddenException('Only owner can dissolve');

    await this.prisma.$transaction(async (tx) => {
      // 所有成员降回 personal
      await tx.user.updateMany({
        where: { familyGroupId: groupId },
        data: { familyGroupId: null, userLevel: 'personal' },
      });
      // 删除组（级联删除成员、care_notices、broadcasts）
      await tx.familyGroup.delete({ where: { id: groupId } });
    });
  }

  async removeMember(ownerUserId: string, groupId: string, targetUserId: string) {
    const group = await this.prisma.familyGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.ownerUserId !== ownerUserId) throw new ForbiddenException('Only owner can remove');
    if (targetUserId === ownerUserId) {
      throw new BadRequestException('Owner cannot remove themselves; dissolve the group instead');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.deleteMany({
        where: { groupId, userId: targetUserId },
      });
      await tx.user.update({
        where: { id: targetUserId },
        data: { familyGroupId: null, userLevel: 'personal' },
      });
    });
  }

  // ====================================================================
  // 邀请码（生成 / 兑换）
  // ====================================================================
  async generateInviteCode(userId: string, groupId: string): Promise<{ code: string; expiresAt: Date }> {
    const group = await this.prisma.familyGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.ownerUserId !== userId) throw new ForbiddenException('Only owner can invite');

    const memberCount = await this.prisma.familyMember.count({ where: { groupId } });
    if (memberCount >= MAX_FAMILY_MEMBERS) {
      throw new BadRequestException('Family group is full');
    }

    // 6 位 BASE32 邀请码，DB 唯一约束防碰撞（最多重试 5 次）
    let code: string | null = null;
    for (let i = 0; i < 5; i++) {
      const candidate = this.randomInviteCode();
      const exists = await this.prisma.familyGroup.findUnique({
        where: { inviteCode: candidate },
      });
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new ConflictException('Invite code generation failed, retry');

    const expiresAt = new Date(Date.now() + INVITE_CODE_TTL_DAYS * 24 * 3600 * 1000);
    await this.prisma.familyGroup.update({
      where: { id: groupId },
      data: { inviteCode: code, inviteCodeExpiresAt: expiresAt },
    });
    return { code, expiresAt };
  }

  async redeemInviteCode(userId: string, inviteCode: string) {
    const group = await this.prisma.familyGroup.findUnique({
      where: { inviteCode },
    });
    if (!group) throw new NotFoundException('Invalid invite code');
    if (!group.inviteCodeExpiresAt || group.inviteCodeExpiresAt < new Date()) {
      throw new BadRequestException('Invite code expired');
    }

    // 一个用户只能加入一个组
    const existing = await this.prisma.familyMember.findFirst({ where: { userId } });
    if (existing) {
      throw new ConflictException('You are already in a family group');
    }

    const memberCount = await this.prisma.familyMember.count({ where: { groupId: group.id } });
    if (memberCount >= MAX_FAMILY_MEMBERS) {
      throw new BadRequestException('Family group is full');
    }

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.familyMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'guardian', // 默认 guardian；后续 ward 由 owner 调整
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { familyGroupId: group.id, userLevel: 'family_member' },
      });
      return member;
    });
  }

  // ====================================================================
  // 隐私偏好
  // ====================================================================
  async updatePreferences(userId: string, dto: { shareQueryResults?: boolean }) {
    const member = await this.prisma.familyMember.findFirst({ where: { userId } });
    if (!member) throw new NotFoundException('Not in any family group');

    return this.prisma.familyMember.update({
      where: { id: member.id },
      data: {
        shareQueryResults: dto.shareQueryResults ?? member.shareQueryResults,
      },
    });
  }

  // ====================================================================
  // 官方匿名广播（W5 完整实现）
  //
  // 设计要点：
  //  - triggered_by_user_id 仅服务端可见，DTO 强制 @Exclude 不返前端
  //  - 同家庭 + 同 content_hash + 当日 1 条（service 层查重，UNIQUE 在 DB 也加了部分约束）
  //  - AI 检测结果分类为 scam | safe | unknown，按结果以"官方"名义广播
  //  - 配额：免费会员家庭每天 1 条；Pro 不限
  // ====================================================================

  /**
   * 主动广播 / 自动广播入口
   *
   * @param triggeredByUserId 触发者（仅服务端记录，不暴露给家人）
   * @param contentType phone | url | sms | voice
   * @param content 原始内容
   * @param source 'manual_share' | 'auto_query'
   * @param aiClassify 函数：传入 content 返回 {label, contentDisplay, resultDetail}
   *                  允许调用方在外部已经分类的情况下传 null，由 service 调用默认分类器
   */
  async createBroadcast(params: {
    triggeredByUserId: string;
    contentType: 'phone' | 'url' | 'sms' | 'voice';
    content: string;
    source: 'manual_share' | 'auto_query';
    classifier?: (content: string) => Promise<{
      label: 'scam' | 'safe' | 'unknown';
      contentDisplay: string;
      resultDetail: Record<string, unknown>;
    }>;
  }): Promise<{
    delivered: boolean;
    broadcastId?: string;
    resultLabel: 'scam' | 'safe' | 'unknown';
    quotaRemaining: number;
    skipReason?: 'duplicate' | 'quota_exceeded' | 'no_group';
  }> {
    // 1) 查家庭组
    const member = await this.prisma.familyMember.findFirst({
      where: { userId: params.triggeredByUserId },
      include: { group: { include: { members: true } } },
    });
    if (!member) {
      return {
        delivered: false,
        resultLabel: 'unknown',
        quotaRemaining: 0,
        skipReason: 'no_group',
      };
    }

    // 2) AI 分类
    const classifier =
      params.classifier ?? this.defaultClassifier.bind(this);
    const classification = await classifier(params.content);

    // 3) 计算 content_hash（用于排重）
    const contentHash = createHash('sha256')
      .update(`${params.contentType}:${params.content.trim().toLowerCase()}`)
      .digest('hex');

    // 4) 查重：同家庭 + 同 hash + 今日已有
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today0.getTime() + 24 * 3600 * 1000);

    const dup = await this.prisma.familyBroadcast.findFirst({
      where: {
        groupId: member.groupId,
        contentHash,
        createdAt: { gte: today0, lt: tomorrow },
      },
    });
    if (dup) {
      return {
        delivered: false,
        broadcastId: dup.id,
        resultLabel: dup.resultLabel as 'scam' | 'safe' | 'unknown',
        quotaRemaining: await this.getRemainingQuota(member.groupId),
        skipReason: 'duplicate',
      };
    }

    // 5) 配额：家庭每天 1 条免费（service 层校验，Pro 用户由外层判断）
    const todayCount = await this.prisma.familyBroadcast.count({
      where: {
        groupId: member.groupId,
        createdAt: { gte: today0, lt: tomorrow },
      },
    });
    const userIsPro = await this.isUserPro(params.triggeredByUserId);
    const FREE_DAILY_LIMIT = 1;
    if (!userIsPro && todayCount >= FREE_DAILY_LIMIT) {
      // 配额耗尽：AI 已分类但不入库不分发
      return {
        delivered: false,
        resultLabel: classification.label,
        quotaRemaining: 0,
        skipReason: 'quota_exceeded',
      };
    }

    // 6) 入库
    const broadcast = await this.prisma.familyBroadcast.create({
      data: {
        groupId: member.groupId,
        triggeredByUserId: params.triggeredByUserId,
        contentType: params.contentType,
        contentHash,
        contentDisplay: classification.contentDisplay,
        resultLabel: classification.label,
        resultDetail: classification.resultDetail as any,
        source: params.source,
      },
    });

    // 7) 推送给其他成员（不含触发者）
    const otherMembers = member.group.members.filter(
      (m) => m.userId !== params.triggeredByUserId,
    );
    if (otherMembers.length > 0) {
      const titleByLabel = {
        scam: '📢 已识别诈骗',
        safe: '📢 经核实暂未发现风险',
        unknown: '📢 暂无法确认，请谨慎',
      } as const;
      await this.notification.sendPushBatch(
        otherMembers.map((m) => ({
          userId: m.userId,
          title: titleByLabel[classification.label],
          body: classification.contentDisplay,
          category: 'family_broadcast',
          customData: {
            broadcastId: broadcast.id,
            groupId: member.groupId,
            resultLabel: classification.label,
          },
        })),
      );
    }

    return {
      delivered: true,
      broadcastId: broadcast.id,
      resultLabel: classification.label,
      quotaRemaining: Math.max(0, FREE_DAILY_LIMIT - (todayCount + 1)),
    };
  }

  /**
   * 默认 AI 分类器（一期 stub）
   * 二期：接入 V2 已有的 AI 编排，传入 content 走完整 Doubao/DeepSeek failover
   */
  private async defaultClassifier(content: string): Promise<{
    label: 'scam' | 'safe' | 'unknown';
    contentDisplay: string;
    resultDetail: Record<string, unknown>;
  }> {
    const trimmed = content.trim();
    // 简化判断（W5 stub）：含关键词的判为可疑
    const lower = trimmed.toLowerCase();
    const scamKeywords = ['退费', '解冻', '安全账户', '验证码', '冒充', '客服', '加微信'];
    const isLikelyScam = scamKeywords.some((k) => lower.includes(k));
    if (isLikelyScam) {
      return {
        label: 'scam',
        contentDisplay: this.maskSensitive(trimmed),
        resultDetail: {
          confidence: 0.6,
          features: ['含可疑话术关键词'],
          advice: ['不要按对方说的做', '不要回拨/加微信', '如已转账请立刻拨打 96110'],
        },
      };
    }
    return {
      label: 'unknown',
      contentDisplay: this.maskSensitive(trimmed),
      resultDetail: {
        confidence: 0.3,
        features: ['AI 无法确认'],
        advice: ['通过其他渠道核实对方身份', '不要轻易转账或提供验证码'],
      },
    };
  }

  /** 简单脱敏：手机号中间 4 位打码，链接保留前 16 字符 */
  private maskSensitive(text: string): string {
    // 手机号脱敏
    text = text.replace(/(\d{3})\d{4}(\d{4})/g, '$1****$2');
    // 文本太长截断
    return text.length > 200 ? text.slice(0, 200) + '…' : text;
  }

  private async getRemainingQuota(groupId: string): Promise<number> {
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today0.getTime() + 24 * 3600 * 1000);
    const count = await this.prisma.familyBroadcast.count({
      where: { groupId, createdAt: { gte: today0, lt: tomorrow } },
    });
    return Math.max(0, 1 - count);
  }

  private async isUserPro(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionExpire: true },
    });
    if (!user) return false;
    if (user.subscriptionStatus !== 'premium') return false;
    if (user.subscriptionExpire && user.subscriptionExpire < new Date()) return false;
    return true;
  }

  async getMyBroadcasts(userId: string, limit = 50) {
    const member = await this.prisma.familyMember.findFirst({ where: { userId } });
    if (!member) return [];
    return this.prisma.familyBroadcast.findMany({
      where: { groupId: member.groupId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      // ⚠️ 严禁 select triggeredByUserId！服务层就过滤掉，DTO 再防一道
      select: {
        id: true,
        groupId: true,
        contentType: true,
        contentDisplay: true,
        resultLabel: true,
        resultDetail: true,
        source: true,
        createdAt: true,
      },
    });
  }

  // ====================================================================
  // 关怀机制（W3 实现）
  // 每天凌晨 1:00 扫描全部用户最后活跃时间：
  //   - 连续 2 天未活跃 → 发 push 给同家庭其他成员
  //   - 连续 3 天 → push + sms（每家庭 1 条/天限）
  //   - 重新活跃 → 自动清除未发送的提醒（不需要主动取消，cron 时检查 last_active_at）
  // ====================================================================
  async scanInactiveMembers(): Promise<{
    scanned: number;
    notified2days: number;
    notified3plus: number;
    smsSent: number;
  }> {
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);

    // 1) 查所有加入了家庭组的用户
    const candidates = await this.prisma.familyMember.findMany({
      where: {
        // 排除 owner-only group（单人家庭组无人需要被提醒）
        group: {
          members: { some: {} },
        },
      },
      include: {
        user: true,
        group: {
          include: { members: { include: { user: true } } },
        },
      },
    });

    let notified2days = 0;
    let notified3plus = 0;
    let smsSent = 0;

    for (const candidate of candidates) {
      const lastActive = candidate.user.lastActiveAt;
      if (!lastActive) continue;

      const daysInactive = Math.floor((now - lastActive.getTime()) / dayMs);
      if (daysInactive < 2) continue;

      // 同家庭其他成员（不含本人）
      const otherMembers = candidate.group.members.filter(
        (m) => m.userId !== candidate.userId,
      );
      if (otherMembers.length === 0) continue;

      // 今日已发过提醒就跳过（per group + inactive_user 一天 1 次）
      const todayStartDate = new Date(today0);
      const alreadySent = await this.prisma.familyCareNotice.findFirst({
        where: {
          groupId: candidate.groupId,
          inactiveUserId: candidate.userId,
          sentAt: { gte: todayStartDate },
        },
      });
      if (alreadySent) continue;

      // 决定 channel：< 3 天只 push；≥ 3 天 push + sms
      const channels: ('push' | 'sms')[] = daysInactive >= 3 ? ['push', 'sms'] : ['push'];

      // 每个家庭每天最多 1 条 SMS（防止成本失控）
      const smsAlreadySent = await this.prisma.familyCareNotice.findFirst({
        where: {
          groupId: candidate.groupId,
          channel: 'sms',
          sentAt: { gte: todayStartDate },
        },
      });

      const finalChannels = channels.filter((c) =>
        c === 'sms' ? !smsAlreadySent : true,
      );
      if (finalChannels.length === 0) continue;

      // 调用通知层（push + sms 各自实现；这里先记录，实际发送由 worker 处理）
      const notifiedIds = otherMembers.map((m) => m.userId);

      // 文案
      const inactiveDisplayName =
        candidate.user.nickname || candidate.user.wechatNickname || '家人';

      for (const channel of finalChannels) {
        await this.prisma.familyCareNotice.create({
          data: {
            groupId: candidate.groupId,
            inactiveUserId: candidate.userId,
            notifiedUserIds: notifiedIds as any,
            daysInactive,
            channel,
          },
        });

        if (channel === 'push') {
          // 给同家庭其他成员发 push
          await this.notification.sendPushBatch(
            otherMembers.map((m) => ({
              userId: m.userId,
              title: '家庭关怀提醒',
              body: `${inactiveDisplayName} 已连续 ${daysInactive} 天未打开 App，建议联系确认`,
              category: 'family_care',
              customData: {
                groupId: candidate.groupId,
                inactiveUserId: candidate.userId,
                daysInactive,
              },
            })),
          );
        } else if (channel === 'sms') {
          smsSent += 1;
          // 给同家庭其他成员发短信（按 region 路由）
          for (const m of otherMembers) {
            const phone = m.user.phone;
            if (!phone) continue;
            const region: 'CN' | 'INTL' =
              (m.user.regionCode ?? '').toUpperCase().startsWith('CN') ? 'CN' : 'INTL';
            await this.notification.sendSms({
              userId: m.userId,
              phone,
              template: 'family_care_inactive',
              variables: {
                inactiveName: inactiveDisplayName,
                days: String(daysInactive),
              },
              region,
            });
          }
        }
      }

      if (daysInactive === 2) notified2days += 1;
      else notified3plus += 1;
    }

    return {
      scanned: candidates.length,
      notified2days,
      notified3plus,
      smsSent,
    };
  }

  // ====================================================================
  // 内部工具
  // ====================================================================
  private randomInviteCode(): string {
    // 6 位 BASE32 风格（去掉易混字符 0 O 1 I）
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(6);
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[bytes[i] % alphabet.length];
    }
    return code;
  }

  private composeGroupDto(group: any, currentUserId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const members = group.members.map((m: any) => {
      const lastActive = m.user.lastActiveAt as Date | null;
      const activityStatus = this.computeActivityStatus(lastActive);
      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        nickname: m.user.nickname || m.user.wechatNickname,
        avatar: m.user.avatar,
        elderModeEnabled: m.user.elderModeEnabled,
        activityStatus,
        joinedAt: m.joinedAt,
      };
    });

    return {
      id: group.id,
      name: group.name,
      ownerUserId: group.ownerUserId,
      memberCount: members.length,
      maxMembers: MAX_FAMILY_MEMBERS,
      isOwner: group.ownerUserId === currentUserId,
      createdAt: group.createdAt,
      members,
    };
  }

  private computeActivityStatus(lastActive: Date | null): string {
    if (!lastActive) return 'unknown';
    const now = Date.now();
    const last = lastActive.getTime();
    const dayMs = 24 * 3600 * 1000;
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const todayStart = today0.getTime();

    if (last >= todayStart) return 'active_today';
    const daysAgo = Math.floor((now - last) / dayMs);
    if (daysAgo <= 1) return 'inactive_1day';
    if (daysAgo === 2) return 'inactive_2days';
    return 'inactive_3plus';
  }
}
