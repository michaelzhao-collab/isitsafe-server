/**
 * Input Parser：normalizeContent、detectType
 * screenshot 先预留 OCR 接口（MVP 由客户端 OCR 后传 text，或后端返回友好提示）
 */
import { Injectable } from '@nestjs/common';
import { normalizeContent, detectType, InputType } from '../../../common/utils/normalize';

export interface ParsedInput {
  inputType: InputType;
  normalizedContent: string;
  originalContent: string;
}

@Injectable()
export class InputParserService {
  normalizeContent(raw: string): string {
    return normalizeContent(raw);
  }

  detectType(content: string, isScreenshot = false): InputType {
    return detectType(content, isScreenshot);
  }

  parse(content: string, isScreenshot = false): ParsedInput {
    const originalContent = content?.trim() || '';
    const inputType = this.detectType(originalContent, isScreenshot);
    const normalizedContent = this.normalizeContent(originalContent);
    return { inputType, normalizedContent, originalContent };
  }

  /**
   * 预留：服务端 OCR。MVP 不实现，由客户端 OCR 后传 text，或返回友好提示
   */
  async ocrFromImage(_imageBase64: string): Promise<string> {
    // TODO: 接入 OCR 服务（如 Tesseract / 云 OCR）
    return Promise.resolve('');
  }
}
