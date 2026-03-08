import { IsString, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class AnalyzeTextDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsIn(['zh', 'en'])
  language?: 'zh' | 'en';

  @IsOptional()
  @IsString()
  country?: string;
}

export class AnalyzeScreenshotDto {
  /** 客户端 OCR 后的文本，或 base64 图片（服务端 OCR 预留） */
  @IsString()
  content: string;

  @IsOptional()
  @IsIn(['zh', 'en'])
  language?: 'zh' | 'en';

  @IsOptional()
  @IsBoolean()
  isScreenshot?: boolean;

  /** 用户上传截图后的 CDN 地址（客户端先 POST /api/upload/file type=screenshot 得到），供落库与后台展示 */
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
