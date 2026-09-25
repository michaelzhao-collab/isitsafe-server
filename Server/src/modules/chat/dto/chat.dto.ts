import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
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

/**
 * 消息体跨字段校验（2026-09-07 复核修复）。
 *
 * 挂在 `type` 上而不是 content/payload 上：那两个字段带 @IsOptional()，
 * class-validator 遇到 undefined/null 会**跳过该属性的全部校验器**，
 * 于是「缺 content 的 text」「缺 payload 的 image」照样能过——这正是
 * 第一版修法的漏洞（已由 DTO 自测发现）。type 永远存在，校验必定执行。
 *
 * 规则：
 *   - text / bigEmoji：content 必须存在且非空白
 *   - voice：payload 必须是对象，含本站 CDN 的 https url + 数字 duration
 *   - image：payload 必须是对象，含本站 CDN 的 https url
 *
 * 为什么限制 url 域名：原来 payload 不受任何约束，任何群成员都能塞一个外链，
 * 让其他人的客户端去加载攻击者的服务器（拉图即暴露 IP/UA，是可用的追踪手段）。
 * 与 deepfake.service.assertOwnCdnUrl 同一口径；未配 CDN_DOMAIN（dev）时只校验 https。
 */
@ValidatorConstraint({ name: 'chatMessageShape', async: false })
class ChatMessageShapeConstraint implements ValidatorConstraintInterface {
  validate(_type: unknown, args: ValidationArguments): boolean {
    return this.reasonFor(args) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    return this.reasonFor(args) ?? 'invalid message';
  }

  /**
   * 返回 null 表示合法，否则返回原因。
   * 不用实例字段存原因：class-validator 会复用同一个 constraint 实例，
   * 并发请求下错误信息会串到别的请求上。
   */
  private reasonFor(args: ValidationArguments): string | null {
    const dto = args.object as SendMessageDto;
    const type = dto?.type;

    if (type === 'text' || type === 'bigEmoji') {
      const c = dto.content;
      if (typeof c !== 'string' || c.trim().length === 0) {
        return 'content is required for type=text/bigEmoji';
      }
      return null;
    }

    if (type !== 'voice' && type !== 'image') return null;

    const payload = dto.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return `payload is required for type=${type}`;
    }
    const p = payload as Record<string, unknown>;
    if (!this.isAllowedUrl(p.url)) {
      return 'payload.url must be an https URL on the app CDN';
    }
    if (p.thumb != null && !this.isAllowedUrl(p.thumb)) {
      return 'payload.thumb must be an https URL on the app CDN';
    }
    if (type === 'voice' && typeof p.duration !== 'number') {
      return 'payload.duration must be a number for type=voice';
    }
    return null;
  }

  private isAllowedUrl(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    if (url.protocol !== 'https:') return false;
    const cdn = (process.env.CDN_DOMAIN || '').replace(/\/$/, '');
    if (!cdn) return true; // dev 环境未配 CDN_DOMAIN：只保证 https
    try {
      return url.host === new URL(cdn).host;
    } catch {
      return true; // CDN_DOMAIN 配错不应连带拒收消息
    }
  }
}

export class SendMessageDto {
  /** 客户端生成的 UUID，用于发送幂等去重（同 group 内唯一） */
  @IsString()
  @MaxLength(64)
  clientMsgId!: string;

  /** 跨字段规则（content/payload 是否必需）挂在这里，理由见 ChatMessageShapeConstraint */
  @IsIn(['text', 'voice', 'image', 'bigEmoji'])
  @Validate(ChatMessageShapeConstraint)
  type!: MessageType;

  /** text 正文 / 语音转文字；voice、image 可为空 */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  /** voice{url,duration,transcript} / image{url,w,h,thumb} / bigEmoji 无 */
  @IsOptional()
  @IsObject()
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
