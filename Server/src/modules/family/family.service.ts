import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../../redis/redis.service';
import { EntitlementService } from '../quota/entitlement.service';
import { ChatService } from '../chat/chat.service';
import { randomBytes, createHash } from 'crypto';
import { regionToTimezone, daysDiffInTz, localHour } from '../../common/utils/region-timezone';
import { normalizeByType } from '../../common/utils/content-normalize';

/**
 * 家庭组容量上限（S5-7 按 owner 订阅动态）
 *   免费：3 人 / Pro：10 人
 */
/// 老版本客户端的免费家庭人数上限（保持不变，服务端部署对老用户零影响）
const FREE_MAX_FAMILY_MEMBERS = 3;
/// V5.1 新版客户端的免费家庭人数上限（版本门控：仅带 X-App-Version 的新版请求生效）
const FREE_MAX_FAMILY_MEMBERS_IM = 5;
const PAID_MAX_FAMILY_MEMBERS = 10;

/**
 * 创建家庭组数量上限（S5-10 多家庭支持）
 *   免费：1 个 / Pro：3 个
 *   加入家庭组数量不限（自己家、伴侣家、父母家等场景）
 */
const FREE_MAX_OWNED_GROUPS = 1;
const PAID_MAX_OWNED_GROUPS = 3;

const INVITE_CODE_TTL_DAYS = 7;
/**
 * 2026-09-07 复核：这里原本定义了 INVITE_CODE_MAX_USES = 4 但从未被使用，
 * 读代码的人会误以为邀请码有次数限制。已删除该常量：
 * 家庭邀请码本来就是"一码多人用"（群主发一次到家族群，几个家人各自兑换），
 * 名额已由 getMaxMembersFor 的人数上限把关，再加次数限制反而是行为变更。
 * 有效期仍由 INVITE_CODE_TTL_DAYS 控制。
 */

/// 邀请链接基址（后端下发给客户端，客户端不再写死域名）；可用环境变量覆盖
const INVITE_SHARE_BASE_URL =
  process.env.INVITE_SHARE_BASE_URL || 'https://www.starlensai.com/i';

/// 广播分布式锁 TTL：覆盖 AI 检测 P95 ≤ 15s 上限，留 4× buffer 防慢调用
const BROADCAST_LOCK_TTL_SEC = 60;
/// 免费家庭每天 1 条官方广播
const BROADCAST_FREE_DAILY_LIMIT = 1;

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
  private readonly logger = new Logger(FamilyService.name);

  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
    private redis: RedisService,
    private entitlement: EntitlementService,
    private chat: ChatService,
  ) {}

  /**
   * V5.1 群生命周期系统消息（入群 / 退群 / 被移出）。fire-and-forget：
   * 家庭 DB 是事实源，系统消息失败不能让家庭操作回滚。
   */
  private postLifecycleSystemMessage(groupId: string, text: string): void {
    this.chat
      .postSystemMessage(groupId, 'system', { content: text })
      .catch((err) => this.logger.warn(`[FamilyLifecycle] system message failed: ${err?.message ?? err}`));
  }

  /**
   * 用户离开某个家庭（主动退 / 被移出 / 家庭解散）后，修正 user 表上的单值冗余字段。
   *
   * 2026-09-07 复核：原来三处都无条件写 `familyGroupId: null, userLevel: 'personal'`，
   * 多家庭用户退出 B 家后，A 家的身份在 user 表被一并抹成 personal。
   * 现在：
   *   - familyGroupId 指向的不是正在离开的这个组 → 完全不动；
   *   - 指向的就是这个组 → 若用户还在别的家庭，改指向其中之一（保持 family_member），
   *     否则才真正清空并降回 personal。
   * 注：user.familyGroupId / userLevel 是多家庭之前留下的单值冗余字段，
   *     真正的事实源是 family_members 表；这里只做尽量不误伤的维护。
   */
  private async repointUserPrimaryGroup(
    tx: Prisma.TransactionClient,
    userId: string,
    leavingGroupId: string,
  ): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { familyGroupId: true },
    });
    if (user?.familyGroupId !== leavingGroupId) return; // 指向别的家庭，别动

    const remaining = await tx.familyMember.findFirst({
      where: { userId, groupId: { not: leavingGroupId } },
      orderBy: { joinedAt: 'asc' },
      select: { groupId: true },
    });
    await tx.user.update({
      where: { id: userId },
      data: remaining
        ? { familyGroupId: remaining.groupId, userLevel: 'family_member' }
        : { familyGroupId: null, userLevel: 'personal' },
    });
  }

  /** 群昵称 > 用户昵称 > 手机尾号 */
  private async lifecycleName(groupId: string, userId: string): Promise<string> {
    const m = await this.prisma.familyMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { displayName: true, user: { select: { nickname: true, phone: true } } },
    });
    return (
      m?.displayName?.trim() ||
      m?.user?.nickname?.trim() ||
      (m?.user?.phone ? `尾号${m.user.phone.slice(-4)}` : '') ||
      '家人'
    );
  }

  // ====================================================================
  // 心跳：用户主动打开 App 时上报
  //
  // S2-1 + S2-2 改造：
  //   - 接受可选 triggerSource：'cold_launch' | 'foreground' | 'universal_link' | 'share_extension'
  //     PRD"仅 push 被点击但无后续动作不算活跃" —— 客户端不会主动传 'push_tap'，
  //     若不慎传入，服务端会接受并写入数组但**不计入** activeCount。
  //   - activeCount 改为"日内唯一计数"语义：同一天首次 = 1；
  //     后续命中只更新 lastActiveAt + 追加去重的 triggerSource（不再无界 increment）。
  // ====================================================================
  async recordHeartbeat(
    userId: string,
    triggerSource: string = 'foreground',
  ): Promise<{ active: boolean; todayCount: number; triggerSources: string[] }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    // 归一化 + 白名单（防垃圾值）
    const validSource = this.normalizeTriggerSource(triggerSource);
    const countsAsActive = validSource !== 'push_tap'; // push_tap 不算活跃

    // 先读旧 record（用于 trigger_sources 数组合并）
    const existing = await this.prisma.userActivity.findUnique({
      where: { userId_date: { userId, date: today } },
      select: { activeCount: true, triggerSources: true },
    });

    let nextSources: string[];
    if (existing) {
      const arr = Array.isArray(existing.triggerSources) ? (existing.triggerSources as string[]) : [];
      nextSources = arr.includes(validSource) ? arr : [...arr, validSource];
    } else {
      nextSources = [validSource];
    }

    if (existing) {
      // 已有当日记录：只刷 lastActiveAt + 合并 trigger_sources；不递增 activeCount
      await this.prisma.userActivity.update({
        where: { userId_date: { userId, date: today } },
        data: {
          lastActiveAt: now,
          triggerSources: nextSources as any,
          // 历史活跃 0（如老数据）且本次算活跃，则首次置 1（兜底）
          activeCount: existing.activeCount === 0 && countsAsActive ? 1 : existing.activeCount,
          firstActiveAt: existing.activeCount === 0 && countsAsActive ? now : undefined,
        },
      });
    } else {
      // 首次：activeCount = countsAsActive ? 1 : 0
      await this.prisma.userActivity.create({
        data: {
          userId,
          date: today,
          activeCount: countsAsActive ? 1 : 0,
          firstActiveAt: countsAsActive ? now : null,
          lastActiveAt: now,
          triggerSources: nextSources as any,
        },
      });
    }

    // 同步 user.last_active_at（仅当算活跃才更新；否则 push_tap 不应"复活"成员状态）
    if (countsAsActive) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: now },
      });
    }

    // 重新取 activeCount 返回（保持现有接口语义）
    const after = await this.prisma.userActivity.findUnique({
      where: { userId_date: { userId, date: today } },
      select: { activeCount: true },
    });
    return {
      active: countsAsActive,
      todayCount: after?.activeCount ?? 0,
      triggerSources: nextSources,
    };
  }

  /** 归一化 trigger_source 白名单 */
  private normalizeTriggerSource(s: string): string {
    const v = (s || '').trim().toLowerCase();
    const allowed = ['cold_launch', 'foreground', 'universal_link', 'share_extension', 'push_tap'];
    return allowed.includes(v) ? v : 'foreground';
  }

  // ====================================================================
  // 家庭组 CRUD
  // ====================================================================
  async createGroup(userId: string, name?: string) {
    // S5-10 多家庭：免费用户最多创建 1 个家庭组，Pro 最多 3 个
    const ownedCount = await this.prisma.familyGroup.count({
      where: { ownerUserId: userId },
    });
    const e = await this.entitlement.getUserEntitlement(userId);
    const maxOwned = e.isUnlimited ? PAID_MAX_OWNED_GROUPS : FREE_MAX_OWNED_GROUPS;
    if (ownedCount >= maxOwned) {
      throw new BadRequestException(
        e.isUnlimited
          ? `You already own ${ownedCount} family groups (max ${PAID_MAX_OWNED_GROUPS} for Pro)`
          : `Free users can create 1 family group. Upgrade to Pro to create up to ${PAID_MAX_OWNED_GROUPS}.`,
      );
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

  async getMyGroup(userId: string, imCapable = false) {
    // S5-10：兼容旧 iOS 客户端 — 仍返回单一家庭组（按 joinedAt 最早的那个），
    //        新客户端应该用 getMyGroups 拉全量
    const member = await this.prisma.familyMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { group: { include: { members: { include: { user: true } } } } },
    });
    if (!member) return null;
    return await this.composeGroupDto(member.group, userId, imCapable);
  }

  /**
   * S5-10 多家庭：拉取我加入的全部家庭组
   * 按 joinedAt 升序（最早加入的排前），客户端自行 sort/select active
   */
  async getMyGroups(userId: string, imCapable = false) {
    const members = await this.prisma.familyMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { group: { include: { members: { include: { user: true } } } } },
    });
    const groups = await Promise.all(
      members.map((m) => this.composeGroupDto(m.group, userId, imCapable)),
    );
    return groups;
  }

  /**
   * 退出家庭组。
   *
   * 2026-09-07 复核（已实测复现）：原来签名是 leaveGroup(userId)，controller 把路径上的
   * :id 丢掉了，service 用 findFirst({ userId }) 取 joinedAt 最早的成员记录 —— 用户同时在
   * A、B 两个家庭时，调 groups/B/leave 实际退出的是 A。现在按 groupId 精确定位。
   * groupId 保持可选：万一线上还有不传的老调用，退回旧行为但打 warn 便于观测。
   */
  async leaveGroup(userId: string, groupId?: string) {
    if (!groupId) {
      this.logger.warn(
        `[FamilyLeave] leaveGroup called without groupId (userId=${userId}); ` +
          'falling back to earliest membership — caller should pass groupId',
      );
    }
    const member = groupId
      ? await this.prisma.familyMember.findUnique({
          where: { groupId_userId: { groupId, userId } },
          include: { group: true },
        })
      : await this.prisma.familyMember.findFirst({
          where: { userId },
          orderBy: { joinedAt: 'asc' },
          include: { group: true },
        });
    if (!member) throw new NotFoundException('Not in any family group');
    if (member.role === 'owner') {
      throw new ForbiddenException('Owner cannot leave; dissolve the group instead');
    }
    const leavingName = await this.lifecycleName(member.groupId, userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.delete({ where: { id: member.id } });
      // V4-P3 主动离群也清掉自己跟此组里所有人的 mute 关系
      await tx.familyCareMute.deleteMany({
        where: {
          groupId: member.groupId,
          OR: [
            { recipientUserId: userId },
            { targetUserId: userId },
          ],
        },
      });
      // 2026-09-07 复核：只在冗余字段确实指向本组时才改，避免误伤其它家庭的身份
      await this.repointUserPrimaryGroup(tx, userId, member.groupId);
    });
    this.postLifecycleSystemMessage(member.groupId, `${leavingName} 退出了家庭`);
  }

  async dissolveGroup(userId: string, groupId: string) {
    // 解散前先把通知所需信息一次性取出：组名、owner 显示名、其它成员 (userId + language)
    // —— 事务里删完组就拿不到这些信息了
    const group = await this.prisma.familyGroup.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: { nickname: true, wechatNickname: true } },
        members: {
          include: { user: { select: { id: true, language: true } } },
        },
      },
    });
    if (!group) throw new NotFoundException('Group not found');
    if (group.ownerUserId !== userId) throw new ForbiddenException('Only owner can dissolve');

    const ownerDisplayName =
      group.owner.nickname?.trim() ||
      group.owner.wechatNickname?.trim() ||
      (group.members.some((m) => (m.user.language || 'zh') === 'en') ? 'A family member' : '家人');
    const groupName = (group.name || '').trim();
    const recipients = group.members
      .filter((m) => m.userId !== userId)
      .map((m) => ({ userId: m.userId, language: (m.user.language || 'zh') as string }));

    const memberUserIds = group.members.map((m) => m.userId);

    await this.prisma.$transaction(async (tx) => {
      // 删组之前先逐个修正冗余字段：2026-09-07 复核 —— 原来是
      // `updateMany where familyGroupId=groupId → null/personal`，把还在别的家庭里的
      // 成员也一并降级了。repointUserPrimaryGroup 会改指向其仍有效的家庭。
      // 必须在 delete 之前跑，否则级联删除后查不到"还在哪些家庭"。
      for (const uid of memberUserIds) {
        await this.repointUserPrimaryGroup(tx, uid, groupId);
      }
      // 删除组（级联删除成员、care_notices、broadcasts）
      await tx.familyGroup.delete({ where: { id: groupId } });
    });

    // 解散完成后：给其余成员发 push + 写一条本人专属的系统消息
    // 失败不阻塞主流程返回；任何一条挂掉都只是这位成员收不到，业主已经看到解散成功
    if (recipients.length > 0) {
      void this.notifyFamilyDissolved({ recipients, ownerDisplayName, groupName });
    }
  }

  /// V4 复核扩展：解散家庭后通知其余成员
  /// 文案区分语言；push category 用 'family_dissolved' 便于客户端区分埋点
  private async notifyFamilyDissolved(params: {
    recipients: Array<{ userId: string; language: string }>;
    ownerDisplayName: string;
    groupName: string;
  }) {
    const { recipients, ownerDisplayName, groupName } = params;

    const buildCopy = (lang: string) => {
      const isEN = lang === 'en';
      const label = groupName || (isEN ? 'your family' : '家庭');
      const quotedLabel = isEN ? `"${label}"` : `「${label}」`;
      return {
        pushTitle: isEN ? 'Family disbanded' : '家庭已解散',
        pushBody: isEN
          ? `${ownerDisplayName} disbanded ${quotedLabel}.`
          : `${ownerDisplayName} 解散了 ${quotedLabel}。`,
        msgTitle: isEN ? 'Family disbanded' : '家庭已解散',
        msgContent: isEN
          ? `${ownerDisplayName} disbanded ${quotedLabel}. You've been removed automatically — feel free to create or join another one.`
          : `${ownerDisplayName} 解散了 ${quotedLabel}。你已自动退出，可重新创建或加入其它家庭。`,
      };
    };

    try {
      await this.notification.sendPushBatch(
        recipients.map(({ userId, language }) => {
          const copy = buildCopy(language);
          return {
            userId,
            title: copy.pushTitle,
            body: copy.pushBody,
            category: 'family_dissolved',
            // 同一用户最多保留一条解散通知（避免多次解散叠加）
            collapseId: `family_dissolved:${userId}`,
          };
        }),
      );
    } catch (err: any) {
      // 兜底：push 投递失败不阻塞写消息中心
      console.warn('[FAMILY_DISSOLVE_PUSH_FAILED]', err?.message ?? err);
    }

    try {
      await this.prisma.appMessage.createMany({
        data: recipients.map(({ userId, language }) => {
          const copy = buildCopy(language);
          return {
            targetUserId: userId,
            language,
            status: 'active',
            title: copy.msgTitle,
            content: copy.msgContent,
          };
        }),
      });
    } catch (err: any) {
      console.warn('[FAMILY_DISSOLVE_MSG_FAILED]', err?.message ?? err);
    }
  }

  async removeMember(ownerUserId: string, groupId: string, targetUserId: string) {
    const group = await this.prisma.familyGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.ownerUserId !== ownerUserId) throw new ForbiddenException('Only owner can remove');
    if (targetUserId === ownerUserId) {
      throw new BadRequestException('Owner cannot remove themselves; dissolve the group instead');
    }
    const removedName = await this.lifecycleName(groupId, targetUserId);

    await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.deleteMany({
        where: { groupId, userId: targetUserId },
      });
      // V4-P3 清掉跟此人相关的所有静音记录（无论作为 recipient 还是 target）
      // 不然踢出去后留的孤儿数据：本人重新被加进来时仍按老 mute 配置发 / 不发
      await tx.familyCareMute.deleteMany({
        where: {
          groupId,
          OR: [
            { recipientUserId: targetUserId },
            { targetUserId: targetUserId },
          ],
        },
      });
      // 2026-09-07 复核：同 leaveGroup，多家庭下不要把别的家庭身份一起抹掉
      await this.repointUserPrimaryGroup(tx, targetUserId, groupId);
    });
    this.postLifecycleSystemMessage(groupId, `${removedName} 已被群主移出家庭`);
  }

  // ====================================================================
  // 邀请码（生成 / 兑换）
  // ====================================================================
  async generateInviteCode(
    userId: string,
    groupId: string,
    imCapable = false,
  ): Promise<{ code: string; expiresAt: Date; shareLink: string }> {
    const group = await this.prisma.familyGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    // S5-12：任一家庭成员都可邀请（不再仅 owner）；踢人 / 解散仍 owner only
    const callerMember = await this.prisma.familyMember.findFirst({
      where: { userId, groupId },
    });
    if (!callerMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const memberCount = await this.prisma.familyMember.count({ where: { groupId } });
    const maxMembers = await this.getMaxMembersFor(group.ownerUserId, imCapable);
    if (memberCount >= maxMembers) {
      throw new BadRequestException(
        `Family group is full (${memberCount}/${maxMembers}). Upgrade to Pro for up to ${PAID_MAX_FAMILY_MEMBERS} members.`,
      );
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
    return { code, expiresAt, shareLink: `${INVITE_SHARE_BASE_URL}/${code}` };
  }

  /**
   * 兑换邀请码加入家庭组
   *
   * S3-3 COPPA：
   *   - 已标记 is_minor 的用户：必须传 parentConsent=true，且服务端落 parent_consent_at
   *   - 非 minor 用户：parentConsent 字段忽略（也允许传）
   *   - 一期不主动检查 birthday → minor；交由客户端在注册流程中自报
   */
  async redeemInviteCode(
    userId: string,
    inviteCode: string,
    opts: { parentConsent?: boolean; imCapable?: boolean } = {},
  ) {
    const group = await this.prisma.familyGroup.findUnique({
      where: { inviteCode },
    });
    if (!group) throw new NotFoundException('Invalid invite code');
    if (!group.inviteCodeExpiresAt || group.inviteCodeExpiresAt < new Date()) {
      throw new BadRequestException('Invite code expired');
    }

    // S5-10 多家庭：用户可以加入多个家庭组，但不能在同一个组里出现两次
    const existingInThisGroup = await this.prisma.familyMember.findFirst({
      where: { userId, groupId: group.id },
    });
    if (existingInThisGroup) {
      throw new ConflictException('You are already a member of this family group');
    }

    // 预检：快速失败 + 给出友好的 x/y 文案（真正的把关在下面的事务里）
    const maxMembers = await this.getMaxMembersFor(group.ownerUserId, opts.imCapable ?? false);
    const memberCount = await this.prisma.familyMember.count({ where: { groupId: group.id } });
    if (memberCount >= maxMembers) {
      throw new BadRequestException(
        `Family group is full (${memberCount}/${maxMembers})`,
      );
    }

    // COPPA：is_minor 必须勾选监护人同意
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isMinor: true, parentConsentAt: true },
    });
    if (u?.isMinor && !u.parentConsentAt && !opts.parentConsent) {
      throw new ForbiddenException({
        code: 'parental_consent_required',
        message: 'Parental consent is required for minors to join a family group',
      });
    }

    const member = await this.prisma.$transaction(async (tx) => {
      // 2026-09-07 复核：名额校验原来完全在事务外，两人同时兑换最后一个名额会双双通过
      // （DB 上没有任何人数约束兜底）。这里先对 group 行取排他锁（Postgres 下
      // UPDATE 即 FOR UPDATE），锁内重新计数，把并发串行化。
      await tx.familyGroup.update({
        where: { id: group.id },
        data: { lastSeq: { increment: 0 } },
        select: { id: true },
      });
      const liveCount = await tx.familyMember.count({ where: { groupId: group.id } });
      if (liveCount >= maxMembers) {
        throw new BadRequestException(`Family group is full (${liveCount}/${maxMembers})`);
      }
      const created = await tx.familyMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'guardian', // 默认 guardian；后续 ward 由 owner 调整
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          familyGroupId: group.id,
          userLevel: 'family_member',
          // 首次勾选则记录时间；后续保持原值
          parentConsentAt: opts.parentConsent && !u?.parentConsentAt ? new Date() : undefined,
        },
      });
      return created;
    });
    this.postLifecycleSystemMessage(group.id, `${await this.lifecycleName(group.id, userId)} 加入了家庭`);
    return member;
  }

  // ====================================================================
  // 隐私偏好
  // ====================================================================
  /**
   * 同步"我的查询结果是否自动播报给家人"开关。
   *
   * 2026-09-07 复核：原来是 findFirst({ userId }) → 只改 joinedAt 最早的那个家庭。
   * 用户在群设置里点开关，改的却可能是另一个家庭，且 UI 无从察觉。
   * 现在：
   *   - 传了 groupId → 只改该家庭（iOS 群设置页应该传，见下方 controller）；
   *   - 没传 groupId → 视为"全局隐私偏好"，一次性改掉全部 membership 并打 warn。
   *     选"全部"而不是"第一个"，是因为这是隐私开关：用户关掉时，
   *     在所有家庭都关掉才符合预期，比随机改一个家庭安全。
   */
  async updatePreferences(
    userId: string,
    dto: { shareQueryResults?: boolean; groupId?: string },
  ) {
    if (dto.groupId) {
      const member = await this.prisma.familyMember.findUnique({
        where: { groupId_userId: { groupId: dto.groupId, userId } },
      });
      if (!member) throw new NotFoundException('Not a member of this family group');
      return this.prisma.familyMember.update({
        where: { id: member.id },
        data: { shareQueryResults: dto.shareQueryResults ?? member.shareQueryResults },
      });
    }

    const members = await this.prisma.familyMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
    });
    if (members.length === 0) throw new NotFoundException('Not in any family group');
    if (members.length > 1) {
      this.logger.warn(
        `[FamilyPrefs] updatePreferences without groupId for userId=${userId} ` +
          `across ${members.length} groups — applying to all; caller should pass groupId`,
      );
    }
    if (dto.shareQueryResults !== undefined) {
      await this.prisma.familyMember.updateMany({
        where: { userId },
        data: { shareQueryResults: dto.shareQueryResults },
      });
    }
    // 返回体保持旧形状（单个成员对象），避免破坏现有客户端解析
    return this.prisma.familyMember.findUnique({ where: { id: members[0].id } });
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
    skipReason?: 'duplicate' | 'quota_exceeded' | 'no_group' | 'in_progress' | 'disabled_by_user';
  }> {
    // 2026-09-07 复核：这里原来是 findFirst({ userId }) —— 只往 joinedAt 最早的那个家庭
    // 播报。多家庭用户（自己家 + 父母家）高风险查询时，另一个家庭的家人永远收不到提醒。
    // 现在遍历全部 membership 逐个投递；AI 分类用下面的 classifyOnce 记忆化，
    // 保证无论几个家庭都只花一次 AI 的钱（原有"单条最坏 1 次 AI"的成本约束不变）。
    const memberships = await this.prisma.familyMember.findMany({
      where: { userId: params.triggeredByUserId },
      orderBy: { joinedAt: 'asc' },
      include: { group: { include: { members: true } } },
    });
    if (memberships.length === 0) {
      return {
        delivered: false,
        resultLabel: 'unknown',
        quotaRemaining: 0,
        skipReason: 'no_group',
      };
    }

    const rawClassifier = params.classifier ?? this.defaultClassifier.bind(this);
    let classified: Awaited<ReturnType<typeof rawClassifier>> | null = null;
    const classifyOnce = async (content: string) => {
      if (!classified) classified = await rawClassifier(content);
      return classified;
    };

    const results = [] as Array<
      Awaited<ReturnType<FamilyService['createBroadcastForMember']>>
    >;
    for (const m of memberships) {
      results.push(
        await this.createBroadcastForMember(m, { ...params, classifier: classifyOnce }),
      );
    }

    // 返回体保持单个结果的旧形状（调用方都只看 delivered / skipReason）：
    // 优先返回任意一个成功投递的；全失败时返回第一个，保留其 skipReason。
    return results.find((r) => r.delivered) ?? results[0];
  }

  /** 单个家庭组的广播投递（createBroadcast 的按组实现） */
  private async createBroadcastForMember(
    member: { groupId: string; shareQueryResults: boolean; group: { members: { userId: string }[] } },
    params: {
      triggeredByUserId: string;
      contentType: 'phone' | 'url' | 'sms' | 'voice';
      content: string;
      source: 'manual_share' | 'auto_query';
      classifier?: (content: string) => Promise<{
        label: 'scam' | 'safe' | 'unknown';
        contentDisplay: string;
        resultDetail: Record<string, unknown>;
      }>;
    },
  ): Promise<{
    delivered: boolean;
    broadcastId?: string;
    resultLabel: 'scam' | 'safe' | 'unknown';
    quotaRemaining: number;
    skipReason?: 'duplicate' | 'quota_exceeded' | 'no_group' | 'in_progress' | 'disabled_by_user';
  }> {
    // ────────────────────────────────────────────────
    // 流程（S1-2 改造）：
    //   ② 计算 content_hash + ymd
    //   ③ Redis SETNX 抢锁；抢不到说明同秒并发，直接返 in_progress
    //      （另一个请求会完成 AI + 入库 + 推送，对端无需重复工作）
    //   ④ 锁内 DB 预查重 / 预查配额：免费用户/重复内容跳过 AI（不花钱）
    //   ⑤ 调 AI 分类
    //   ⑥ Transaction 入库：DB UNIQUE 索引兜底（极端情况下还是会抓 P2002）
    //   ⑦ 推送 + 重算剩余配额
    //   ⑧ finally 释放锁
    //
    // 老逻辑的问题：AI 调用在 transaction / 配额检查之前，并发场景下两人
    // 同秒触发同号码会双扣费且都拿到结果（DB UNIQUE 也是后加的）。改造后
    // 单条最坏花 1 次 AI 钱。
    // ────────────────────────────────────────────────

    // ①.5 S2-3：auto_query 必须尊重成员的"我触发的查询触发广播" 开关
    if (params.source === 'auto_query' && !member.shareQueryResults) {
      return {
        delivered: false,
        resultLabel: 'unknown',
        quotaRemaining: 0,
        skipReason: 'disabled_by_user',
      };
    }

    // ② content_hash + 当日范围 + 锁 key
    const contentHash = this.computeContentHash(params.contentType, params.content);
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today0.getTime() + 24 * 3600 * 1000);
    const ymd = this.formatYmd(today0);
    const lockKey = `family_broadcast:${member.groupId}:${contentHash}:${ymd}`;

    // ③ 抢锁
    const lockAcquired = await this.redis.acquireLock(lockKey, BROADCAST_LOCK_TTL_SEC);
    if (!lockAcquired) {
      // 同秒并发：另一个请求正在跑 AI + 入库。对端无需重复，直接返。
      return {
        delivered: false,
        resultLabel: 'unknown',
        quotaRemaining: await this.computeQuotaRemaining(member.groupId, today0, tomorrow),
        skipReason: 'in_progress',
      };
    }

    try {
      // ④a DB 预查重（AI 之前，零成本）
      const dup = await this.prisma.familyBroadcast.findFirst({
        where: {
          groupId: member.groupId,
          contentHash,
          createdAt: { gte: today0, lt: tomorrow },
        },
        select: { id: true, resultLabel: true },
      });
      if (dup) {
        return {
          delivered: false,
          broadcastId: dup.id,
          resultLabel: dup.resultLabel as 'scam' | 'safe' | 'unknown',
          quotaRemaining: await this.computeQuotaRemaining(member.groupId, today0, tomorrow),
          skipReason: 'duplicate',
        };
      }

      // ④b 配额预查（AI 之前，零成本）
      const userIsPro = await this.isUserPro(params.triggeredByUserId);
      const todayCount = await this.prisma.familyBroadcast.count({
        where: {
          groupId: member.groupId,
          createdAt: { gte: today0, lt: tomorrow },
        },
      });
      if (!userIsPro && todayCount >= BROADCAST_FREE_DAILY_LIMIT) {
        return {
          delivered: false,
          resultLabel: 'unknown',
          quotaRemaining: 0,
          skipReason: 'quota_exceeded',
        };
      }

      // ⑤ AI 分类（确认要花钱了才调）
      // 多家庭时上层传的是记忆化过的 classifyOnce，这里重复调用不会重复花 AI 的钱
      const classifier = params.classifier ?? this.defaultClassifier.bind(this);
      const classification = await classifier(params.content);

      // ⑥ 入库（DB partial unique 兜底处理 P2002）
      let broadcastId: string;
      try {
        const created = await this.prisma.familyBroadcast.create({
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
          select: { id: true },
        });
        broadcastId = created.id;
      } catch (err: any) {
        // Prisma P2002 unique constraint violation → 极端并发兜底
        if (err?.code === 'P2002') {
          const conflictDup = await this.prisma.familyBroadcast.findFirst({
            where: {
              groupId: member.groupId,
              contentHash,
              createdAt: { gte: today0, lt: tomorrow },
            },
            select: { id: true, resultLabel: true },
          });
          return {
            delivered: false,
            broadcastId: conflictDup?.id,
            resultLabel: (conflictDup?.resultLabel as 'scam' | 'safe' | 'unknown') ?? classification.label,
            quotaRemaining: await this.computeQuotaRemaining(member.groupId, today0, tomorrow),
            skipReason: 'duplicate',
          };
        }
        throw err;
      }

      // ⑦ 推送给其他成员（不含触发者）
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
              broadcastId,
              groupId: member.groupId,
              resultLabel: classification.label,
            },
            // S5-3：同一广播 ID 在客户端可被替换（如二期撤回时下发同 collapseId 的"已撤回"通知）
            collapseId: `broadcast:${broadcastId}`,
          })),
        );
      }

      return {
        delivered: true,
        broadcastId,
        resultLabel: classification.label,
        quotaRemaining: await this.computeQuotaRemaining(member.groupId, today0, tomorrow),
      };
    } finally {
      // ⑧ 主动释放锁（不等 TTL，避免下一个相同 hash 请求阻塞最多 60s）
      await this.redis.releaseLock(lockKey);
    }
  }

  /**
   * content_hash 算法
   * S5-1：按类型走归一化器（phone E.164 / URL canonical / 全半角）→ sha256
   * 相同语义内容（如 "+86 159-1234-5678" 与 "15912345678"）哈希一致，
   * 配合 family_broadcasts 的 partial unique 索引实现真正的家庭内当日排重。
   */
  private computeContentHash(contentType: string, content: string): string {
    const normalized = normalizeByType(
      contentType as 'phone' | 'url' | 'sms' | 'voice',
      content,
    );
    return createHash('sha256').update(`${contentType}:${normalized}`).digest('hex');
  }

  private formatYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  }

  private async computeQuotaRemaining(
    groupId: string,
    today0: Date,
    tomorrow: Date,
  ): Promise<number> {
    const used = await this.prisma.familyBroadcast.count({
      where: { groupId, createdAt: { gte: today0, lt: tomorrow } },
    });
    return Math.max(0, BROADCAST_FREE_DAILY_LIMIT - used);
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

  /**
   * "Pro" 判定 — 决定 1 条/天的官方广播配额是否豁免。
   * 个人 Pro / 家庭 owner / 家庭 member 都视为 isUnlimited，统一豁免。
   * 走 EntitlementService 复用 Query 侧同一份家庭权益分发逻辑。
   */
  private async isUserPro(userId: string): Promise<boolean> {
    const e = await this.entitlement.getUserEntitlement(userId);
    return e.isUnlimited;
  }

  /**
   * 监护人远程切换被监护人长辈模式
   * 权限：currentUser 必须与 targetUser 在同一家庭组，且 currentUser 是 owner/guardian
   *      target 不能修改自己（自己用 /api/user/v3/elder-mode）
   */
  async setMemberElderMode(currentUserId: string, targetUserId: string, enabled: boolean) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Use /api/user/v3/elder-mode for yourself');
    }
    // 同家庭组检查
    //
    // 2026-09-07 复核：原来先 findFirst 取调用者的第一个家庭，再要求 target 也在**那个**
    // 家庭里。多家庭下（子女自己建了家、又加入父母家）会对第二个家庭的家人误报
    // "不在你的家庭"。改为：找出两人共同所在的家庭，只要有任意一个共同家庭里
    // 调用者是 owner/guardian 就放行。
    const myMemberships = await this.prisma.familyMember.findMany({
      where: { userId: currentUserId },
      select: { groupId: true, role: true },
    });
    if (myMemberships.length === 0) {
      throw new ForbiddenException('Not in any family group');
    }
    const sharedGroups = await this.prisma.familyMember.findMany({
      where: {
        userId: targetUserId,
        groupId: { in: myMemberships.map((m) => m.groupId) },
      },
      select: { groupId: true },
    });
    if (sharedGroups.length === 0) {
      throw new NotFoundException('Target user not in your family group');
    }
    // 权限检查：仅 owner / guardian 可以远程切换（任一共同家庭里满足即可）
    const sharedIds = new Set(sharedGroups.map((g) => g.groupId));
    const canToggle = myMemberships.some(
      (m) => sharedIds.has(m.groupId) && m.role !== 'ward',
    );
    if (!canToggle) {
      throw new ForbiddenException('Only owner/guardian can toggle elder mode for others');
    }
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { elderModeEnabled: enabled },
    });
    return { success: true, targetUserId, enabled };
  }

  /**
   * 拉取家庭官方消息列表
   *
   * S5-10 信息架构调整（方案 C）：
   *   家庭 Tab 是"inbox"心智 → 默认只返回**别人触发**广播给我的消息，
   *   排除自己触发的（避免与"我的分享历史"重叠）。
   *
   * @param excludeOwn  true（默认）= 仅别人触发的；false = 含自己（"我的分享"场景）
   */
  async getMyBroadcasts(
    userId: string,
    limit = 50,
    excludeOwn = true,
    groupId?: string,
  ) {
    // 2026-09-07 复核：原来 findFirst({ userId }) → inbox 只显示第一个家庭的广播，
    // 多家庭用户永远看不到其它家庭的官方消息。改为默认聚合全部家庭；
    // 传 groupId 时只看该家庭（客户端按群分栏时用）。
    const members = await this.prisma.familyMember.findMany({
      where: { userId, ...(groupId ? { groupId } : {}) },
      select: { groupId: true },
    });
    if (members.length === 0) return [];
    const groupIds = members.map((m) => m.groupId);
    return this.prisma.familyBroadcast.findMany({
      where: {
        groupId: { in: groupIds },
        ...(excludeOwn ? { triggeredByUserId: { not: userId } } : {}),
      },
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
  async scanInactiveMembers(opts: { ignoreLocalHourWindow?: boolean } = {}): Promise<{
    scanned: number;
    notified2days: number;
    notified3plus: number;
    smsSent: number;
    skippedOffHours: number;
  }> {
    const now = new Date();

    // 1) 查所有加入了家庭组的用户
    const candidates = await this.prisma.familyMember.findMany({
      where: {
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
    let skippedOffHours = 0;

    for (const candidate of candidates) {
      const lastActive = candidate.user.lastActiveAt;
      if (!lastActive) continue;

      // S3-6 时区：按本人 region_code 映射本地 tz；缺失则 fallback UTC
      const tz = regionToTimezone(candidate.user.regionCode);

      // 仅在本地 9-22 点触发新提醒（凌晨/深夜不打扰）；admin 手动 runNow 忽略此限制
      if (!opts.ignoreLocalHourWindow) {
        const hour = localHour(now, tz);
        if (hour < 9 || hour >= 22) {
          skippedOffHours += 1;
          continue;
        }
      }

      // 按本人本地日历计算"未活跃天数"
      const daysInactive = daysDiffInTz(lastActive, now, tz);
      if (daysInactive < 2) continue;

      // 同家庭其他成员（不含本人）
      let otherMembers = candidate.group.members.filter(
        (m) => m.userId !== candidate.userId,
      );
      if (otherMembers.length === 0) continue;

      // V4-P3 关怀提醒静音：业主反馈"对方一直不活跃会一直收到 push"
      // 接收人可在 MemberDetailView 关掉「ta 的不活跃提醒」，这里按 (group, target) 过滤掉
      const mutes = await this.prisma.familyCareMute.findMany({
        where: {
          groupId: candidate.groupId,
          targetUserId: candidate.userId,
          recipientUserId: { in: otherMembers.map((m) => m.userId) },
        },
        select: { recipientUserId: true },
      });
      if (mutes.length > 0) {
        const mutedRecipients = new Set(mutes.map((m) => m.recipientUserId));
        otherMembers = otherMembers.filter((m) => !mutedRecipients.has(m.userId));
        if (otherMembers.length === 0) continue;
      }

      // V4 复核扩展：全局通知偏好——接收人关掉「家人不活跃提醒」或「所有通知」时不发 push
      // 注意只过滤 push 通道；SMS 升级路径仍按现状走（手机号是兜底渠道，开关在 iOS 系统设置里）
      otherMembers = otherMembers.filter(
        (m) => (m.user as any).pushAllEnabled !== false
          && (m.user as any).pushFamilyCareEnabled !== false,
      );
      if (otherMembers.length === 0) continue;

      // 本地今天已发过 notice？查最近 20 小时（覆盖时区切换 + DST 边界，绝不重复轰炸）
      const recentWindow = new Date(now.getTime() - 20 * 3600 * 1000);
      const alreadySent = await this.prisma.familyCareNotice.findFirst({
        where: {
          groupId: candidate.groupId,
          inactiveUserId: candidate.userId,
          sentAt: { gte: recentWindow },
        },
      });
      if (alreadySent) continue;

      // 决定 channel：< 3 天只 push；≥ 3 天 push + sms
      const channels: ('push' | 'sms')[] = daysInactive >= 3 ? ['push', 'sms'] : ['push'];

      // 每个家庭近 20 小时最多 1 条 SMS（防止成本失控）
      const smsAlreadySent = await this.prisma.familyCareNotice.findFirst({
        where: {
          groupId: candidate.groupId,
          channel: 'sms',
          sentAt: { gte: recentWindow },
        },
      });

      const finalChannels = channels.filter((c) =>
        c === 'sms' ? !smsAlreadySent : true,
      );
      if (finalChannels.length === 0) continue;

      const notifiedIds = otherMembers.map((m) => m.userId);
      const inactiveDisplayName =
        candidate.user.nickname || candidate.user.wechatNickname || '家人';

      // S4-4 投递状态：每条 notice 独立 stats，避免不同 channel 的计数交叉污染
      for (const channel of finalChannels) {
        const notice = await this.prisma.familyCareNotice.create({
          data: {
            groupId: candidate.groupId,
            inactiveUserId: candidate.userId,
            notifiedUserIds: notifiedIds as any,
            daysInactive,
            channel,
          },
        });

        if (channel === 'push') {
          const pushStats = { pushDelivered: 0, pushFailed: 0, escalatedToSms: false };
          const result = await this.notification.sendPushBatch(
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
              // S5-3：同一关怀对象当天的连续提醒会替换（避免锁屏堆叠 N 条）
              collapseId: `care:${candidate.userId}`,
            })),
          );
          pushStats.pushDelivered += result.delivered;
          pushStats.pushFailed += result.failed;

          // S4-4：第 2 天 push 全失败 → 提前升级 SMS（绕过常规 daysInactive>=3 阈值）
          const pushAllFailed = result.delivered === 0 && result.failed > 0;
          const canEscalate =
            pushAllFailed &&
            daysInactive === 2 &&
            !finalChannels.includes('sms') &&
            !smsAlreadySent;
          if (canEscalate) {
            pushStats.escalatedToSms = true;
            smsSent += 1;
            const escalatedStats = { smsDelivered: 0, smsFailed: 0, escalatedToSms: true };
            const escalatedNotice = await this.prisma.familyCareNotice.create({
              data: {
                groupId: candidate.groupId,
                inactiveUserId: candidate.userId,
                notifiedUserIds: notifiedIds as any,
                daysInactive,
                channel: 'sms',
              },
            });
            for (const m of otherMembers) {
              const phone = m.user.phone;
              if (!phone) continue;
              const region: 'CN' | 'INTL' =
                (m.user.regionCode ?? '').toUpperCase().startsWith('CN') ? 'CN' : 'INTL';
              const r = await this.notification.sendSms({
                userId: m.userId,
                phone,
                template: 'family_care_inactive',
                variables: {
                  inactiveName: inactiveDisplayName,
                  days: String(daysInactive),
                },
                region,
              });
              if (r.delivered) escalatedStats.smsDelivered += 1;
              else escalatedStats.smsFailed += 1;
            }
            await this.prisma.familyCareNotice.update({
              where: { id: escalatedNotice.id },
              data: { deliveryStatus: escalatedStats as any },
            });
          }
          await this.prisma.familyCareNotice.update({
            where: { id: notice.id },
            data: { deliveryStatus: pushStats as any },
          });
        } else if (channel === 'sms') {
          const smsStats = { smsDelivered: 0, smsFailed: 0, escalatedToSms: false };
          smsSent += 1;
          for (const m of otherMembers) {
            const phone = m.user.phone;
            if (!phone) continue;
            const region: 'CN' | 'INTL' =
              (m.user.regionCode ?? '').toUpperCase().startsWith('CN') ? 'CN' : 'INTL';
            const r = await this.notification.sendSms({
              userId: m.userId,
              phone,
              template: 'family_care_inactive',
              variables: {
                inactiveName: inactiveDisplayName,
                days: String(daysInactive),
              },
              region,
            });
            if (r.delivered) smsStats.smsDelivered += 1;
            else smsStats.smsFailed += 1;
          }
          await this.prisma.familyCareNotice.update({
            where: { id: notice.id },
            data: { deliveryStatus: smsStats as any },
          });
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
      skippedOffHours,
    };
  }

  // ====================================================================
  // V4-P3 关怀提醒静音：按 (recipient, target) 关掉特定家人的不活跃 push
  // ====================================================================

  /// 列出我（recipient）在某组里静音的目标 userId
  async listCareMutedTargets(recipientUserId: string, groupId: string): Promise<string[]> {
    await this.assertMemberOf(groupId, recipientUserId);
    const rows = await this.prisma.familyCareMute.findMany({
      where: { groupId, recipientUserId },
      select: { targetUserId: true },
    });
    return rows.map((r) => r.targetUserId);
  }

  /// 切换静音：muted=true → 不再收到 target 的不活跃 push；false → 恢复
  async setCareMute(
    recipientUserId: string,
    groupId: string,
    targetUserId: string,
    muted: boolean,
  ): Promise<{ muted: boolean }> {
    await this.assertMemberOf(groupId, recipientUserId);
    if (targetUserId === recipientUserId) {
      throw new BadRequestException('不能静音自己');
    }
    // target 必须也是同组成员（不然没意义）
    const targetMember = await this.prisma.familyMember.findFirst({
      where: { groupId, userId: targetUserId },
      select: { id: true },
    });
    if (!targetMember) {
      throw new NotFoundException('目标家人不在该家庭');
    }

    if (muted) {
      await this.prisma.familyCareMute.upsert({
        where: {
          groupId_recipientUserId_targetUserId: {
            groupId,
            recipientUserId,
            targetUserId,
          },
        },
        create: { groupId, recipientUserId, targetUserId },
        update: {},
      });
    } else {
      await this.prisma.familyCareMute.deleteMany({
        where: { groupId, recipientUserId, targetUserId },
      });
    }
    return { muted };
  }

  /**
   * V5.1 群聊免打扰：设置我在某群的聊天推送开关。
   * muted=true → 该群聊天离线推送横幅不再发给我（未读角标仍累加，客户端渲染小红点）。
   * 高风险强提醒不受此开关影响（走独立通道）。
   */
  async setChatMute(
    userId: string,
    groupId: string,
    muted: boolean,
  ): Promise<{ muted: boolean }> {
    await this.assertMemberOf(groupId, userId);
    await this.prisma.familyMember.updateMany({
      where: { groupId, userId },
      data: { chatMuted: muted },
    });
    return { muted };
  }

  private async assertMemberOf(groupId: string, userId: string): Promise<void> {
    const m = await this.prisma.familyMember.findFirst({
      where: { groupId, userId },
      select: { id: true },
    });
    if (!m) throw new ForbiddenException('你不在该家庭');
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

  /**
   * 按 owner 订阅状态返回家庭组容量上限
   *   free → FREE_MAX_FAMILY_MEMBERS（3）
   *   personal_pro / family_owner / family_member → PAID_MAX_FAMILY_MEMBERS（10）
   * EntitlementService 已在 S1-4 注入，复用同一份权益判定
   */
  private async getMaxMembersFor(ownerUserId: string, imCapable = false): Promise<number> {
    const e = await this.entitlement.getUserEntitlement(ownerUserId);
    if (e.isUnlimited) return PAID_MAX_FAMILY_MEMBERS;
    // 免费档：新版客户端触发才放宽到 5，老版本仍为 3（零影响）
    return imCapable ? FREE_MAX_FAMILY_MEMBERS_IM : FREE_MAX_FAMILY_MEMBERS;
  }

  private async composeGroupDto(group: any, currentUserId: string, imCapable = false) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // S5-12：拉当前查询人给本组成员设的私人备注，map by familyMemberId
    const memberIds: string[] = group.members.map((m: any) => m.id);
    const myAliases = memberIds.length
      ? await this.prisma.familyMemberAlias.findMany({
          where: {
            creatorUserId: currentUserId,
            familyMemberId: { in: memberIds },
          },
          select: { familyMemberId: true, alias: true },
        })
      : [];
    const aliasMap = new Map(myAliases.map((a) => [a.familyMemberId, a.alias]));

    const members = group.members.map((m: any) => {
      const lastActive = m.user.lastActiveAt as Date | null;
      // V4 复核 #6：与 scanInactiveMembers 用同一份 tz 日历日口径，避免 cron
      // 不推送但 UI 仍显示 "inactive_2days" 的对外矛盾
      const activityStatus = this.computeActivityStatus(lastActive, m.user.regionCode);
      // V3-J SOS 拨号需要真号码；家庭内成员手机号互可见（毕竟是家人）
      // 但隐私上 phone_display 做轻度脱敏，phone（完整号码）仅用于客户端 tel:// 拨号
      const phone = m.user.phone as string | undefined;
      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        nickname: m.user.nickname || m.user.wechatNickname,
        avatar: m.user.avatar,
        elderModeEnabled: m.user.elderModeEnabled,
        activityStatus,
        joinedAt: m.joinedAt,
        phone: phone ?? null,
        phoneDisplay: phone ? this.maskPhone(phone) : null,
        // S5-12：family 内的命名（display_name 全员可见，myAlias 仅自己可见）
        displayName: m.displayName ?? null,
        myAlias: aliasMap.get(m.id) ?? null,
        // 2026-09-07 复核：表里一直有 share_query_results，但从不下发，
        // 导致 iOS 群设置页的"分享我的查询结果"开关永远显示为开（本地写死 true）。
        // 隐私考虑：只对"我自己"这条返回真实值，看别人是 null——
        // 别人有没有关掉自动播报不该暴露给其他家庭成员。
        shareQueryResults: m.userId === currentUserId ? m.shareQueryResults : null,
      };
    });

    // 按 owner 订阅状态动态返回容量上限（免费档新版 5 / 老版 3）
    const maxMembers = await this.getMaxMembersFor(group.ownerUserId, imCapable);

    return {
      id: group.id,
      name: group.name,
      ownerUserId: group.ownerUserId,
      memberCount: members.length,
      maxMembers,
      isOwner: group.ownerUserId === currentUserId,
      createdAt: group.createdAt,
      members,
    };
  }

  /**
   * S5-12：成员改自己在该家庭内的称呼（display_name）
   * 全员可见。NULL → 回退到 user.nickname
   */
  async setMyDisplayName(
    userId: string,
    groupId: string,
    displayName: string | null,
  ) {
    const member = await this.prisma.familyMember.findFirst({
      where: { userId, groupId },
    });
    if (!member) throw new NotFoundException('Not a member of this group');
    const trimmed = displayName?.trim() || null;
    if (trimmed && trimmed.length > 64) {
      throw new BadRequestException('Display name too long (max 64 chars)');
    }
    await this.prisma.familyMember.update({
      where: { id: member.id },
      data: { displayName: trimmed },
    });
    return { success: true, displayName: trimmed };
  }

  /**
   * V5.1 群昵称方案 B：群主给「任意成员」设置群昵称（全员可见）。
   * 与 setMyDisplayName 并存，都写 displayName 字段，冲突时后写为准。
   */
  async setMemberDisplayNameByOwner(
    ownerUserId: string,
    groupId: string,
    targetMemberId: string,
    displayName: string | null,
  ) {
    const group = await this.prisma.familyGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.ownerUserId !== ownerUserId) {
      throw new ForbiddenException('Only the family owner can rename members');
    }
    const target = await this.prisma.familyMember.findFirst({
      where: { id: targetMemberId, groupId },
    });
    if (!target) throw new NotFoundException('Member not found in this group');
    const trimmed = displayName?.trim() || null;
    if (trimmed && trimmed.length > 64) {
      throw new BadRequestException('Display name too long (max 64 chars)');
    }
    await this.prisma.familyMember.update({
      where: { id: target.id },
      data: { displayName: trimmed },
    });
    return { success: true, memberId: target.id, displayName: trimmed };
  }

  /**
   * S5-12：给同家庭某成员设私人备注（仅创建者可见）
   *   alias = 非空 → upsert
   *   alias = null/空 → 删除
   */
  async setAlias(
    creatorUserId: string,
    targetMemberId: string,
    alias: string | null,
  ) {
    const target = await this.prisma.familyMember.findUnique({
      where: { id: targetMemberId },
      select: { id: true, groupId: true },
    });
    if (!target) throw new NotFoundException('Target member not found');
    // creator 必须是同一家庭组成员
    const callerMember = await this.prisma.familyMember.findFirst({
      where: { userId: creatorUserId, groupId: target.groupId },
    });
    if (!callerMember) {
      throw new ForbiddenException('You are not in this family group');
    }
    const trimmed = alias?.trim() || null;
    if (trimmed === null) {
      await this.prisma.familyMemberAlias.deleteMany({
        where: { familyMemberId: targetMemberId, creatorUserId },
      });
      return { success: true, alias: null };
    }
    if (trimmed.length > 64) {
      throw new BadRequestException('Alias too long (max 64 chars)');
    }
    await this.prisma.familyMemberAlias.upsert({
      where: {
        familyMemberId_creatorUserId: {
          familyMemberId: targetMemberId,
          creatorUserId,
        },
      },
      create: { familyMemberId: targetMemberId, creatorUserId, alias: trimmed },
      update: { alias: trimmed },
    });
    return { success: true, alias: trimmed };
  }

  private maskPhone(phone: string): string {
    if (phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }

  private computeActivityStatus(lastActive: Date | null, regionCode?: string | null): string {
    if (!lastActive) return 'unknown';
    // 与 scanInactiveMembers 一致：按本人 region 的本地日历日计差
    // （之前 UI 用 24h 滚动 + 服务器本地零点，跟 cron 时区日历不一致）
    const tz = regionToTimezone(regionCode);
    const daysAgo = daysDiffInTz(lastActive, new Date(), tz);
    if (daysAgo <= 0) return 'active_today';
    if (daysAgo === 1) return 'inactive_1day';
    if (daysAgo === 2) return 'inactive_2days';
    return 'inactive_3plus';
  }
}
