import { Exclude, Expose, Type } from 'class-transformer';

/**
 * 家庭组成员 DTO（返回给前端）
 * ⚠️ 仅暴露成员基本信息，不暴露查询历史等隐私
 */
export class FamilyMemberDto {
  @Expose() id!: string;
  @Expose() userId!: string;
  @Expose() role!: 'owner' | 'guardian' | 'ward';
  @Expose() nickname?: string;
  @Expose() avatar?: string;
  @Expose() elderModeEnabled!: boolean;
  /**
   * 关怀活跃状态：
   *  - 'active_today': 🟢 今日已活跃
   *  - 'inactive_1day': 🟡 昨日未活跃
   *  - 'inactive_2days': ⚠️ 已 2 天未活跃
   *  - 'inactive_3plus': 🚨 已 3 天+ 未活跃
   *  - 'unknown': 从未记录
   */
  @Expose() activityStatus!:
    | 'active_today'
    | 'inactive_1day'
    | 'inactive_2days'
    | 'inactive_3plus'
    | 'unknown';
  @Expose() joinedAt!: Date;
}

/**
 * 家庭组完整详情 DTO（返回给前端）
 */
export class FamilyGroupDto {
  @Expose() id!: string;
  @Expose() name?: string;
  @Expose() ownerUserId!: string;
  @Expose() memberCount!: number;
  @Expose() maxMembers!: number;
  /** 是否当前用户是 owner */
  @Expose() isOwner!: boolean;
  @Expose() createdAt!: Date;
  @Expose()
  @Type(() => FamilyMemberDto)
  members!: FamilyMemberDto[];
}

/**
 * 家庭官方广播消息 DTO
 * ⚠️ 严禁返回 triggeredByUserId 给前端（隐私保护）
 */
export class FamilyBroadcastDto {
  @Expose() id!: string;
  @Expose() contentType!: string;
  @Expose() contentDisplay!: string;
  @Expose() resultLabel!: 'scam' | 'safe' | 'unknown';
  @Expose() resultDetail!: Record<string, unknown>;
  @Expose() source!: 'auto_query' | 'manual_share';
  @Expose() createdAt!: Date;

  /** ⚠️ 强制排除：触发者身份永远不返回给前端 */
  @Exclude() triggeredByUserId!: never;
}
