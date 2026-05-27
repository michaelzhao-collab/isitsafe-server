import { IsOptional, IsString, MaxLength } from 'class-validator';

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
