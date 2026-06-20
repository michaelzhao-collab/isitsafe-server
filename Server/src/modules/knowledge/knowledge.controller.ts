import { Body, Controller, Get, Param, Post, Query, UseGuards, Headers, Req } from '@nestjs/common';
import type { Request } from 'express';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

function resolveLanguageFromHeader(header?: string, fallback?: string): 'zh' | 'en' {
  if (fallback === 'en' || fallback === 'zh') return fallback;
  if (!header) return 'zh';
  const h = header.toLowerCase();
  if (h.startsWith('en')) return 'en';
  if (h.includes('en')) return 'en';
  return 'zh';
}

@Controller('knowledge')
export class KnowledgeController {
  constructor(private knowledge: KnowledgeService) {}

  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  async list(
    @Req() req: Request,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('language') language?: string,
    @Headers('x-app-language') langHeader?: string,
  ) {
    const lang = resolveLanguageFromHeader(langHeader, language);
    const viewerUserId = (req.user as any)?.sub as string | undefined;
    return this.knowledge.list(
      category,
      parseInt(page || '1', 10),
      parseInt(pageSize || '20', 10),
      search,
      lang,
      { excludeReportedByUserId: viewerUserId ?? null },
    );
  }

  /** 客户端分类列表：根据语言返回已启用分类 */
  @Get('categories')
  @Public()
  async categories(
    @Query('language') language?: string,
    @Headers('x-app-language') langHeader?: string,
  ) {
    const lang = resolveLanguageFromHeader(langHeader, language) as 'zh' | 'en';
    return this.knowledge.listCategories(lang);
  }

  /// V4 案例库举报（App Store 1.2 UGC 合规）
  /// 一人一案例最多一条；提交后该案例对本人立刻 404，feed 也不再出现
  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  async reportKnowledge(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: { reason?: string; note?: string },
  ) {
    return this.knowledge.submitReport(userId, id, body?.reason, body?.note);
  }

  // 注意：动态 :id 必须放在所有具体路径之后
  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  async getById(@Req() req: Request, @Param('id') id: string) {
    const viewerUserId = (req.user as any)?.sub as string | undefined;
    return this.knowledge.getById(id, viewerUserId ?? null);
  }
}
