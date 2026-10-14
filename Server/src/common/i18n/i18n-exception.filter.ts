import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { headerLanguage } from './language.util';
import { localizeErrorMessage } from './error-messages';

/**
 * 全局 HTTP 异常出口：按 X-App-Language 翻译面向用户的 message（2026-10-14 国际化复核）。
 *
 * - 只处理 HTTP；WebSocket 等其它上下文原样交给 Nest 默认处理
 * - 请求没带 X-App-Language（管理后台、脚本、探活）时不做任何改动
 * - 只改 message 字段（字符串或字符串数组），其余字段（code / retryAfterSeconds / quota…）原样保留
 * - 状态码不变；未登记的文案原样返回（见 error-messages.ts）
 */
@Catch(HttpException)
export class I18nHttpExceptionFilter extends BaseExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    if (host.getType() !== 'http') return super.catch(exception, host);
    try {
      const req = host.switchToHttp().getRequest();
      const lang = headerLanguage(req?.headers?.['x-app-language']);
      if (!lang) return super.catch(exception, host);

      const body = exception.getResponse();
      let localized: string | Record<string, unknown> | null = null;
      if (typeof body === 'string') {
        const m = localizeErrorMessage(body, lang);
        if (m !== body) localized = { statusCode: exception.getStatus(), message: m };
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        const msg = obj.message;
        if (typeof msg === 'string') {
          const m = localizeErrorMessage(msg, lang);
          if (m !== msg) localized = { ...obj, message: m };
        } else if (Array.isArray(msg)) {
          const arr = msg.map((x) => (typeof x === 'string' ? localizeErrorMessage(x, lang) : x));
          if (arr.some((x, i) => x !== msg[i])) localized = { ...obj, message: arr };
        }
      }
      if (!localized) return super.catch(exception, host);
      return super.catch(new HttpException(localized, exception.getStatus(), { cause: exception }), host);
    } catch {
      // 翻译出任何问题都不能影响原本的错误响应
      return super.catch(exception, host);
    }
  }
}
