import { Controller, Get, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

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
  async list(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('language') language?: string,
    @Headers('x-app-language') langHeader?: string,
  ) {
    const lang = resolveLanguageFromHeader(langHeader, language);
    return this.knowledge.list(
      category,
      parseInt(page || '1', 10),
      parseInt(pageSize || '20', 10),
      search,
      lang,
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

  @Get(':id')
  @Public()
  async getById(@Param('id') id: string) {
    return this.knowledge.getById(id);
  }
}
