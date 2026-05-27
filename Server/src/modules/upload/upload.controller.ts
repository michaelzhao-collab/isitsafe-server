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
const MAX_SIZE_AVATAR = 5 * 1024 * 1024; // 5MB 保留旧 avatar 限制
// 文章/案例图片支持 GIF（用于动图截图）；avatar 仍维持 JPG/PNG
const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

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
}
