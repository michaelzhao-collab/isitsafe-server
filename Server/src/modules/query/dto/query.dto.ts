/**
 * 查询接口入参校验（2026-09-07 复核修复）
 *
 * 原来三个查询路由都用 `@Body('content') content: string`，没有任何校验，
 * 而 QueryService 用 `contains` 做模糊匹配 —— 实测传 `""` / `"1"` / `"+86"` 会变成
 * `ILIKE '%%'` 命中整张风险库，把前 20 条风险记录返回给调用方（数据外泄），
 * 并且因为 risk_level 取第一条（通常是 high），还会 fire-and-forget 触发家庭播报，
 * 让家人收到一条"XXX 查询了 ****"的推送。
 *
 * 这里在入口挡掉明显无意义的输入；服务层还有一层兜底（见 query.service.ts 的
 * isUsableQueryContent），用于保护 ai.service 这类内部调用路径。
 */

import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** 去掉首尾空白后再校验，避免 "   " 这种输入绕过 MinLength */
const trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class PhoneQueryDto {
  @IsString()
  @trim()
  @MaxLength(64)
  // 只允许号码里常见的字符（数字 / 空格 / + - ( ) # *）
  @Matches(/^[\d\s+\-().#*]+$/, { message: '请输入有效的电话号码' })
  // 且至少包含 5 位数字：既挡住 ""、"1"、"+86"，又放行 10086 / 95588 这类 5 位服务短号
  @Matches(/^(?:\D*\d){5,}/, { message: '电话号码至少需要 5 位数字' })
  content!: string;
}

export class UrlQueryDto {
  @IsString()
  @trim()
  @MinLength(4)
  @MaxLength(2048)
  // 至少要有一个 "xxx.yy" 形式的域名部分，协议头可有可无
  @Matches(/^(?:[a-z][a-z0-9+\-.]*:\/\/)?\S*\.\S{2,}/i, { message: '请输入有效的网址' })
  content!: string;
}

export class CompanyQueryDto {
  @IsString()
  @trim()
  @MinLength(2, { message: '公司名称至少 2 个字符' })
  @MaxLength(128)
  content!: string;
}
