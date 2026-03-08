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
const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function fileFilter(allowedTypes: string[]) {
  return (
    _req: any,
    file: Express.Multer.File,
    cb: (err: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new BadRequestException('Allowed types: image/jpeg, image/png, image/webp'), false);
    }
    cb(null, true);
  };
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
    const url = await this.upload.uploadAvatar(userId, file.buffer, file.mimetype);
    return { url };
  }
}
