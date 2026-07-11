import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/** V5.1 自建 IM 消息类型 */
export const MESSAGE_TYPES = [
  'text',
  'voice',
  'image',
  'bigEmoji',
  'card',
  'system',
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export class SendMessageDto {
  /** 客户端生成的 UUID，用于发送幂等去重（同 group 内唯一） */
  @IsString()
  @MaxLength(64)
  clientMsgId!: string;

  @IsIn(['text', 'voice', 'image', 'bigEmoji'])
  type!: MessageType;

  /** text 正文 / 语音转文字；voice、image 可为空 */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  /** voice{url,duration,transcript} / image{url,w,h,thumb} / bigEmoji 无 */
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class PullMessagesDto {
  /** 拉取 seq > afterSeq 的消息（增量同步）；与 beforeSeq 二选一 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterSeq?: number;

  /** 拉取 seq < beforeSeq 的消息（向上翻历史）；与 afterSeq 二选一 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeSeq?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ReadCursorDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  seq!: number;
}

export class RecallMessageDto {
  @IsString()
  messageId!: string;
}

export class ReportMessageDto {
  @IsString()
  groupId!: string;

  @IsString()
  messageId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
