import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadService, UPLOAD_TYPES } from './upload.service';
import { memoryStorage } from 'multer';

const MAX_SIZE_FILE = 10 * 1024 * 1024; // 10MB 统一接口
const MAX_SIZE_AUDIO = 8 * 1024 * 1024; // 8MB 语音上传（60s @ 128kbps ≈ 1MB；留 8 倍冗余）
const MAX_SIZE_AVATAR = 5 * 1024 * 1024; // 5MB 保留旧 avatar 限制
// 文章/案例图片支持 GIF（用于动图截图）；avatar 仍维持 JPG/PNG
const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
// V3-A1 语音深伪上传支持的 audio 类型
const ALLOWED_AUDIO_MIMES = [
  'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/mpeg', 'audio/mp3',
  'audio/wav', 'audio/x-wav',
  'audio/aac',
];

function fileFilter(allowedTypes: string[]) {
  return (
    _req: any,
    file: Express.Multer.File,
    cb: (err: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new BadRequestException(`Allowed types: ${allowedTypes.join(', ')}`), false);
    }
    cb(null, true);
  };
}

/**
 * 通过 buffer 头部 magic byte 判断真实文件类型。
 * 防止攻击者把 .exe 改名 .jpg 后用伪造 Content-Type: image/jpeg 上传：
 * multer 的 mimetype 来自客户端，不可信；这里做服务端二次校验。
 * 返回真实 mime；不在白名单返回 null。
 */
function detectImageMimeFromMagic(buf: Buffer): string | null {
  if (!buf || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';
  // GIF: GIF87a / GIF89a
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) return 'image/gif';
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 ("RIFF....WEBP")
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';
  return null;
}

/**
 * 校验上传 buffer 是真实图片且在 allowedTypes 中；不通过抛 BadRequestException。
 * 同时容忍客户端 mime 与文件实际类型轻度不一致（如 image/jpg vs image/jpeg），以真实 magic 为准。
 */
function ensureRealImage(buffer: Buffer, allowedTypes: string[]): void {
  const detected = detectImageMimeFromMagic(buffer);
  if (!detected) {
    throw new BadRequestException('File content is not a recognizable image');
  }
  if (!allowedTypes.includes(detected)) {
    throw new BadRequestException(`Detected ${detected} but only ${allowedTypes.join(', ')} are allowed`);
  }
}

/**
 * V3-A1 audio magic byte 校验
 * 支持：M4A/MP4 audio / MP3 / WAV / AAC
 */
function detectAudioMimeFromMagic(buf: Buffer): string | null {
  if (!buf || buf.length < 12) return null;
  // ISO Base Media (M4A/AAC in MP4 container): bytes 4-7 = 'ftyp'
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return 'audio/mp4';
  }
  // MP3: ID3 tag 'ID3' or MPEG-1/2 Layer III frame sync (FFFA/FFFB/FFF2/FFF3)
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'audio/mpeg';
  // 严格 MPEG audio sync: 0xFF + (top 11 bits == 0xFFE) + (layer bits == Layer III: 0x02)
  // 即 byte[1] 必须是 0xFA/0xFB/0xF2/0xF3 之一（之前的 0xE0 mask 过宽，会误判任意 0xFFE_ 字节）
  if (buf[0] === 0xff && (buf[1] === 0xfa || buf[1] === 0xfb || buf[1] === 0xf2 || buf[1] === 0xf3)) {
    return 'audio/mpeg';
  }
  // WAV: 'RIFF' xxxx 'WAVE'
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
  ) return 'audio/wav';
  // AAC ADTS (start with 0xFFF1 or 0xFFF9)
  if (buf[0] === 0xff && (buf[1] === 0xf1 || buf[1] === 0xf9)) return 'audio/aac';
  return null;
}

function ensureRealAudio(buffer: Buffer, allowedTypes: string[]): void {
  const detected = detectAudioMimeFromMagic(buffer);
  if (!detected) {
    throw new BadRequestException('File content is not a recognizable audio');
  }
  // 与图片路径对齐：detected 必须在白名单中
  const normalized = detected === 'audio/mp4' ? ['audio/mp4', 'audio/m4a', 'audio/x-m4a'] :
    detected === 'audio/mpeg' ? ['audio/mpeg', 'audio/mp3'] :
    detected === 'audio/wav' ? ['audio/wav', 'audio/x-wav'] :
    detected === 'audio/aac' ? ['audio/aac'] : [];
  if (!normalized.some((m) => allowedTypes.includes(m))) {
    throw new BadRequestException(`Detected ${detected} but allowed: ${allowedTypes.join(', ')}`);
  }
}

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private upload: UploadService) {}

  /**
   * POST /api/upload/file
   * multipart/form-data: file, type (avatar|report|screenshot|case|knowledge)
   * 返回 { url: "https://cdn.isitsafe.com/{folder}/{filename}" }
   */
  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE_FILE },
      fileFilter: fileFilter(ALLOWED_MIMES),
    }),
  )
  async file(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
  ) {
    if (!file?.buffer) throw new BadRequestException('Missing file');
    if (!type?.trim()) throw new BadRequestException('Missing type');
    // 防御纵深：multer 已校验 mimetype 白名单 + 文件大小；此处再用 magic byte 校验真实文件类型
    ensureRealImage(file.buffer, ALLOWED_MIMES);
    const url = await this.upload.uploadFile(
      file.buffer,
      type.trim(),
      userId,
      file.mimetype,
      file.size,
    );
    return { url };
  }

  /**
   * POST /api/upload/avatar（保留旧接口，内部调用统一 uploadFile）
   * multipart/form-data, field: file
   * 返回 { url: "https://cdn.isitsafe.com/avatar/xxx.png" }
   */
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE_AVATAR },
      fileFilter: fileFilter(['image/jpeg', 'image/jpg', 'image/png']),
    }),
  )
  async avatar(@CurrentUser('sub') userId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) throw new BadRequestException('Missing file');
    // 头像只允许 jpg/png，magic byte 二次校验
    ensureRealImage(file.buffer, ['image/jpeg', 'image/png']);
    const url = await this.upload.uploadAvatar(userId, file.buffer, file.mimetype);
    return { url };
  }

  /**
   * V3-A1 语音上传专用接口
   * POST /api/upload/audio
   * multipart/form-data: file (audio/m4a etc.), type='deepfake'
   * 返回 { url: "https://cdn.isitsafe.com/deepfake/xxx.m4a" }
   */
  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE_AUDIO },
      fileFilter: fileFilter(ALLOWED_AUDIO_MIMES),
    }),
  )
  async audio(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
  ) {
    if (!file?.buffer) throw new BadRequestException('Missing file');
    const t = (type?.trim() || 'deepfake');
    // magic byte 二次校验 + 白名单
    ensureRealAudio(file.buffer, ALLOWED_AUDIO_MIMES);
    const url = await this.upload.uploadFile(
      file.buffer,
      t,
      userId,
      file.mimetype || 'audio/mp4',
      file.size,
    );
    return { url };
  }
}
