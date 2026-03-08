import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';

/** 上传类型枚举，对应 OSS 目录 */
export const UPLOAD_TYPES = ['avatar', 'report', 'screenshot', 'case', 'knowledge'] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

const FOLDER_MAP: Record<UploadType, string> = {
  avatar: 'avatar',
  report: 'reports',
  screenshot: 'screenshots',
  case: 'cases',
  knowledge: 'knowledge',
};

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class UploadService {
  private client: OSS | null = null;
  private cdnDomain: string;

  constructor(private config: ConfigService) {
    this.cdnDomain = this.config.get('CDN_DOMAIN', 'https://cdn.isitsafe.com').replace(/\/$/, '');
    const region = this.config.get('OSS_REGION');
    const bucket = this.config.get('OSS_BUCKET');
    const accessKeyId = this.config.get('OSS_ACCESS_KEY_ID');
    const accessKeySecret = this.config.get('OSS_ACCESS_KEY_SECRET');
    if (region && bucket && accessKeyId && accessKeySecret) {
      this.client = new OSS({
        region,
        bucket,
        accessKeyId,
        accessKeySecret,
      });
    }
  }

  /**
   * 统一上传：校验 type、文件类型、大小，生成 objectKey，上传 OSS，返回 CDN URL
   * 禁止本地存储，仅走 OSS + CDN
   */
  async uploadFile(
    buffer: Buffer,
    type: string,
    userId: string,
    mimeType: string,
    fileSize?: number,
  ): Promise<string> {
    if (!this.client) {
      throw new BadRequestException(
        'OSS not configured: set OSS_REGION, OSS_BUCKET, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET',
      );
    }
    const t = type?.toLowerCase();
    if (!UPLOAD_TYPES.includes(t as UploadType)) {
      throw new BadRequestException(`type must be one of: ${UPLOAD_TYPES.join(', ')}`);
    }
    if (!ALLOWED_MIMES.includes(mimeType)) {
      throw new BadRequestException('Allowed types: image/jpeg, image/png, image/webp');
    }
    if (fileSize != null && fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size must be <= ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    const folder = FOLDER_MAP[t as UploadType];
    const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? 'jpg' : 'png';
    const objectKey = `${folder}/${userId}-${Date.now()}.${ext}`;
    await this.client.put(objectKey, buffer, {
      headers: { 'Content-Type': mimeType },
    });
    return `${this.cdnDomain}/${objectKey}`;
  }

  /**
   * 上传头像到 OSS，返回 CDN URL（保留旧接口兼容，内部调用 uploadFile）
   * 路径：avatar/{userId}-{timestamp}.png
   */
  async uploadAvatar(userId: string, buffer: Buffer, mimeType: string): Promise<string> {
    return this.uploadFile(buffer, 'avatar', userId, mimeType);
  }
}
