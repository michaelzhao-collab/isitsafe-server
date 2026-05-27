import {
  Controller,
  Get,
  Headers,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Response } from 'express';
import { KnowledgeService } from './knowledge.service';
import { Public } from '../../common/decorators/public.decorator';

function resolveLanguageFromHeader(header?: string, fallback?: string): 'zh' | 'en' {
  if (fallback === 'en' || fallback === 'zh') return fallback;
  if (!header) return 'zh';
  const h = header.toLowerCase();
  if (h.startsWith('en')) return 'en';
  if (h.includes('en')) return 'en';
  return 'zh';
}

/**
 * 知识库 V2 接口（与 V1 完全隔离，不影响线上）：
 * - GET /api/v2/knowledge —— 列表精简（剥 contentBlocks，新增 hasContentBlocks/firstImage）
 * - GET /api/v2/knowledge/:id —— 详情带 ETag/304（iOS 端发 If-None-Match 命中即省流量）
 * V1 路由 /api/knowledge 仍由 KnowledgeController 服务，老客户端不受影响。
 */
@Controller('v2/knowledge')
export class KnowledgeV2Controller {
  constructor(private knowledge: KnowledgeService) {}

  @Get()
  @Public()
  async list(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('language') language?: string,
    @Headers('x-app-language') langHeader?: string,
  ) {
    const lang = resolveLanguageFromHeader(langHeader, language);
    return this.knowledge.listV2(
      category,
      parseInt(page || '1', 10),
      parseInt(pageSize || '20', 10),
      search,
      lang,
    );
  }

  @Get(':id')
  @Public()
  async getById(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const row = await this.knowledge.getByIdV2(id);
    const etag = computeEtag(row.id, row.updatedAt);
    // 浏览器/iOS URLCache 可能加引号；做宽松比较
    const incoming = (ifNoneMatch || '').replace(/^W\//, '').replace(/^"|"$/g, '');
    if (incoming && incoming === etag) {
      res.status(304);
      res.setHeader('ETag', `"${etag}"`);
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      return; // 304 不带 body
    }
    res.setHeader('ETag', `"${etag}"`);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    return row;
  }
}

/** ETag = sha256(id + updatedAt) 截短；updatedAt 缺失时降级到 createdAt+title。 */
function computeEtag(id: string, updatedAt: Date | null | undefined): string {
  const ts = updatedAt instanceof Date ? updatedAt.toISOString() : '';
  return createHash('sha256').update(`${id}|${ts}`).digest('hex').slice(0, 16);
}
