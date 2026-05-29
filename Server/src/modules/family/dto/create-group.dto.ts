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
