import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/** 上传类型枚举，对应 R2 目录 */
export const UPLOAD_TYPES = ['avatar', 'report', 'screenshot', 'case', 'knowledge', 'article', 'deepfake'] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

const FOLDER_MAP: Record<UploadType, string> = {
  avatar: 'avatar',
  report: 'reports',
  screenshot: 'screenshots',
  case: 'cases',
  knowledge: 'knowledge',
  // 文章正文图片（防诈案例富文本中的内嵌图片）
  article: 'articles',
  // V3-A1 语音深伪上传的 audio 文件（24h 后 cron 自动清理）
  deepfake: 'deepfake',
};

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  // V3-A1 audio types（upload.controller 已 magic byte 校验，这里允许通过 service 层 mime 检查）
  'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/aac'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Cloudflare R2 存储
 * R2 是 S3 兼容协议，复用 @aws-sdk/client-s3 即可。
 * 必需环境变量：R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、R2_BUCKET、CDN_DOMAIN
 * Endpoint 自动拼接为 https://{accountId}.r2.cloudflarestorage.com
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private client: S3Client | null = null;
  private bucket: string;
  private cdnDomain: string;

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
    } else {
      this.logger.warn(
        '[Upload] R2 client not initialized (missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)',
      );
    }
  }

  /**
   * 统一上传：校验 type、文件类型、大小，生成 objectKey，上传 R2，返回 CDN URL
   * 禁止本地存储，仅走 R2 + CDN
   */
  async uploadFile(
    buffer: Buffer,
    type: string,
    userId: string,
    mimeType: string,
    fileSize?: number,
  ): Promise<string> {
    if (!this.client) {
      throw new BadRequestException('图片上传功能暂未配置，请联系管理员');
    }
    if (!this.cdnDomain) {
      throw new BadRequestException('CDN 域名未配置，请联系管理员');
    }
    const t = type?.toLowerCase();
    if (!UPLOAD_TYPES.includes(t as UploadType)) {
      throw new BadRequestException(`type must be one of: ${UPLOAD_TYPES.join(', ')}`);
    }
    if (!ALLOWED_MIMES.includes(mimeType)) {
      throw new BadRequestException(`Unsupported MIME: ${mimeType}. Allowed: ${ALLOWED_MIMES.join(', ')}`);
    }
    if (fileSize != null && fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size must be <= ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    const folder = FOLDER_MAP[t as UploadType];
    const ext = this.extFromMime(mimeType);
    // 加随机后缀防同毫秒并发冲突
    const random = Math.random().toString(36).slice(2, 8);
    const objectKey = `${folder}/${userId}-${Date.now()}-${random}.${ext}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: buffer,
          ContentType: mimeType,
          // R2 公共访问需配合 CDN/Public Bucket 设置；这里不设 ACL（R2 不支持 S3 ACL 字段）
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return `${this.cdnDomain}/${objectKey}`;
    } catch (err: any) {
      this.logger.warn(`[Upload] R2 put failed: ${err?.name ?? err?.message ?? err}`);
      throw new BadRequestException(this.translateR2Error(err));
    }
  }

  /**
   * 上传头像到 R2，返回 CDN URL（保留旧接口兼容，内部调用 uploadFile）
   * 路径：avatar/{userId}-{timestamp}-{rand}.png
   */
  async uploadAvatar(userId: string, buffer: Buffer, mimeType: string): Promise<string> {
    return this.uploadFile(buffer, 'avatar', userId, mimeType);
  }

  private extFromMime(mime: string): string {
    switch (mime) {
      // images
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      case 'image/png':
        return 'png';
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      // V3-A1 audio
      case 'audio/mp4':
      case 'audio/m4a':
      case 'audio/x-m4a':
        return 'm4a';
      case 'audio/mpeg':
      case 'audio/mp3':
        return 'mp3';
      case 'audio/wav':
      case 'audio/x-wav':
        return 'wav';
      case 'audio/aac':
        return 'aac';
      default:
        return 'bin';
    }
  }

  private translateR2Error(err: any): string {
    const name = err?.name || err?.Code;
    if (name === 'NoSuchBucket') return 'R2 Bucket 不存在，请联系管理员';
    if (name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch')
      return '存储凭证错误，请联系管理员';
    if (err?.message?.includes('timeout')) return '上传超时，请检查网络后重试';
    return '上传失败，请检查网络后重试';
  }
}
