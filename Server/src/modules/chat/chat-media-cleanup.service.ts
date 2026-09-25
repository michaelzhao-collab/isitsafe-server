import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * V5.1 家庭 IM 媒体清理（2026-09-07 复核修复）。
 *
 * 问题：撤回消息只把 payload 置空，语音/图片对应的 R2 对象仍然公开可访问，
 * 知道 URL 的人（包括撤回前已收到消息的群成员）仍能打开，"撤回"的承诺不成立。
 *
 * 这里不复用 UploadService：它只提供上传能力、没有删除方法，且属于其他模块的
 * 改动范围。本服务只做一件事——按 CDN URL 反推 objectKey 并删除 R2 对象。
 * 删除是尽力而为：失败只 warn，绝不影响撤回本身（撤回的语义由 DB 墓碑保证）。
 */
@Injectable()
export class ChatMediaCleanupService {
  private readonly logger = new Logger(ChatMediaCleanupService.name);
  private client: S3Client | null = null;
  private readonly bucket: string;
  private readonly cdnDomain: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get('R2_BUCKET', '');
    this.cdnDomain = this.config.get('CDN_DOMAIN', '').replace(/\/$/, '');
    const accountId = this.config.get('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get('R2_SECRET_ACCESS_KEY');
    if (accountId && accessKeyId && secretAccessKey && this.bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  /**
   * 删除一条 voice/image 消息 payload 里引用的对象。
   * fire-and-forget 语义：内部吞掉所有异常，调用方无需 await 结果。
   */
  async deleteMessageMedia(payload: unknown): Promise<void> {
    if (!this.client || !this.cdnDomain) return;
    const urls = this.collectUrls(payload);
    for (const url of urls) {
      const key = this.objectKeyFromCdnUrl(url);
      if (!key) continue;
      try {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      } catch (err) {
        this.logger.warn(`[ChatMedia] delete failed key=${key}: ${String(err)}`);
      }
    }
  }

  /** payload 里可能出现的媒体字段：url（正文）、thumb（缩略图） */
  private collectUrls(payload: unknown): string[] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
    const p = payload as Record<string, unknown>;
    return ['url', 'thumb']
      .map((k) => p[k])
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
  }

  /** 仅接受本项目 CDN 域名下的 URL，避免把任意外链当成自家对象去删 */
  private objectKeyFromCdnUrl(url: string): string | null {
    let parsed: URL;
    let cdn: URL;
    try {
      parsed = new URL(url);
      cdn = new URL(this.cdnDomain);
    } catch {
      return null;
    }
    if (parsed.host !== cdn.host) return null;
    const key = parsed.pathname.replace(/^\//, '');
    return key || null;
  }
}
