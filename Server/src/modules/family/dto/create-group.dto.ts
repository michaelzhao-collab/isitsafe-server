import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFamilyGroupDto {
  /** 家庭组名称（可选，默认 "我的家庭"） */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class RedeemInviteDto {
  @IsString()
  @MaxLength(20)
  inviteCode!: string;

  /**
   * S3-3 COPPA：未成年用户加入家庭组的监护人同意 flag
   * 非 minor 用户传 true / false / 不传都可；minor 用户必须传 true
   */
  @IsOptional()
  @IsBoolean()
  parentConsent?: boolean;
}

export class UpdatePreferencesDto {
  @IsOptional()
  shareQueryResults?: boolean;

  /**
   * 2026-09-07 复核：该开关是"按家庭"的（iOS 在群设置页里展示），
   * 但接口一直没有群维度，服务端只能改用户加入的第一个家庭。
   * 新增可选 groupId：客户端应传当前家庭；不传时按全局隐私偏好处理（改全部家庭）。
   */
  @IsOptional()
  @IsString()
  groupId?: string;
}

export class BroadcastDto {
  /** 内容类型：phone | url | sms | voice */
  @IsString()
  contentType!: string;

  /** 待检测的内容 */
  @IsString()
  @MaxLength(2000)
  content!: string;
}
