import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * 每日一骗后台入参校验（2026-09-07 复核修复）。
 *
 * 原来 controller 的 @Body() 标的是普通 TS 类型（interface/inline type），
 * 全局 ValidationPipe 对非 class 不生效 → 完全没有校验：
 *   - riskLevel 任意字符串直接进卡片 payload，客户端按未知值降级渲染
 *   - review 传错字段名（如 { act: 'approve' }）会静默走 reject 分支
 *   - scheduledDate 格式错误要等到 service 里才抛，错误信息不友好
 */

/** 卡片风险等级取值域，与 iOS CardMessageView 的配色一致 */
const RISK_LEVELS = ['high', 'medium', 'low', 'none'] as const;

/** yyyy-MM-dd */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateDailyScamDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(500)
  summary!: string;

  @IsOptional()
  @IsIn(RISK_LEVELS)
  riskLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  refId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deepLink?: string | null;

  @IsString()
  @Matches(DATE_RE, { message: 'scheduledDate must be yyyy-MM-dd' })
  scheduledDate!: string;
}

export class UpdateDailyScamDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsIn(RISK_LEVELS)
  riskLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deepLink?: string | null;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE, { message: 'scheduledDate must be yyyy-MM-dd' })
  scheduledDate?: string;
}

export class ReviewDailyScamDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';
}
