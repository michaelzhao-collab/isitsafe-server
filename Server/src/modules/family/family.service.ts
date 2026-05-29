import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../../redis/redis.service';
import { EntitlementService } from '../quota/entitlement.service';
import { randomBytes, createHash } from 'crypto';
import { regionToTimezone, daysDiffInTz, localHour } from '../../common/utils/region-timezone';
import { normalizeByType } from '../../common/utils/content-normalize';

const MAX_FAMILY_MEMBERS = 5;
const INVITE_CODE_TTL_DAYS = 7;
const INVITE_CODE_MAX_USES = 4;

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
  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
    private redis: RedisService,
    private entitlement: EntitlementService,
  ) {}

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
    opts: { parentConsent?: boolean } = {},
  ) {
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
        data: {
          familyGroupId: group.id,
          userLevel: 'family_member',
          // 首次勾选则记录时间；后续保持原值
          parentConsentAt: opts.parentConsent && !u?.parentConsentAt ? new Date() : undefined,
        },
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
    skipReason?: 'duplicate' | 'quota_exceeded' | 'no_group' | 'in_progress' | 'disabled_by_user';
  }> {
    // ────────────────────────────────────────────────
    // 流程（S1-2 改造）：
    //   ① 查家庭组（必须先有 groupId 才能算锁 key）
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

    // ① 查家庭组
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
    const currentMember = await this.prisma.familyMember.findFirst({
      where: { userId: currentUserId },
    });
    if (!currentMember) {
      throw new ForbiddenException('Not in any family group');
    }
    const targetMember = await this.prisma.familyMember.findFirst({
      where: { userId: targetUserId, groupId: currentMember.groupId },
    });
    if (!targetMember) {
      throw new NotFoundException('Target user not in your family group');
    }
    // 权限检查：仅 owner / guardian 可以远程切换
    if (currentMember.role === 'ward') {
      throw new ForbiddenException('Only owner/guardian can toggle elder mode for others');
    }
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { elderModeEnabled: enabled },
    });
    return { success: true, targetUserId, enabled };
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
      const otherMembers = candidate.group.members.filter(
        (m) => m.userId !== candidate.userId,
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

      // S4-4 投递状态聚合
      const stats = {
        pushDelivered: 0,
        pushFailed: 0,
        smsDelivered: 0,
        smsFailed: 0,
        escalatedToSms: false,
      };

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
          stats.pushDelivered += result.delivered;
          stats.pushFailed += result.failed;

          // S4-4：第 2 天 push 全失败 → 提前升级 SMS（绕过常规 daysInactive>=3 阈值）
          const pushAllFailed = result.delivered === 0 && result.failed > 0;
          const canEscalate =
            pushAllFailed &&
            daysInactive === 2 &&
            !finalChannels.includes('sms') &&
            !smsAlreadySent;
          if (canEscalate) {
            stats.escalatedToSms = true;
            smsSent += 1;
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
              if (r.delivered) stats.smsDelivered += 1;
              else stats.smsFailed += 1;
            }
            // 单独保存升级 notice 的 deliveryStatus
            await this.prisma.familyCareNotice.update({
              where: { id: escalatedNotice.id },
              data: { deliveryStatus: { ...stats, escalatedToSms: true } as any },
            });
          }
        } else if (channel === 'sms') {
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
            if (r.delivered) stats.smsDelivered += 1;
            else stats.smsFailed += 1;
          }
        }

        // 把投递状态写回本条 notice（覆盖 escalated 的部分由其自身覆盖）
        await this.prisma.familyCareNotice.update({
          where: { id: notice.id },
          data: { deliveryStatus: stats as any },
        });
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

  private maskPhone(phone: string): string {
    if (phone.length < 7) return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
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
