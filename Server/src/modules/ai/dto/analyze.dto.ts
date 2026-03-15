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

  /** 同一对话内连续提问时传上次返回的 conversation_id，历史按会话只显示一条 */
  @IsOptional()
  @IsString()
  conversation_id?: string;
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

  /** 同一对话内连续提问时传上次返回的 conversation_id */
  @IsOptional()
  @IsString()
  conversation_id?: string;
}
