import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('admin/knowledge')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminKnowledgeController {
  constructor(private knowledge: KnowledgeService) {}

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.knowledge.getById(id);
  }

  @Get()
  async list(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('language') language?: string,
  ) {
    return this.knowledge.list(
      category,
      parseInt(page || '1', 10),
      parseInt(pageSize || '20', 10),
      search,
      language || 'zh',
    );
  }

  @Post('upload')
  async upload(
    @Body() body: { title: string; content: string; category: string; tags?: string[]; language?: string; source?: string },
  ) {
    return this.knowledge.create(body);
  }

  /** 批量导入：body.items 为数组，每项 { title, category, content, language? }，ID 自动生成；未指定 language 时使用 body.language 或默认为 zh */
  @Post('bulk-import')
  async bulkImport(@Body() body: { items: Array<{ title: string; category: string; content: string; language?: string }>; language?: string }) {
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return { created: 0, message: 'items 不能为空' };
    }
    const defaultLang = body.language === 'en' ? 'en' : 'zh';
    return this.knowledge.bulkCreate(body.items, defaultLang);
  }

  /** 批量删除：body.ids 为知识库 ID 数组 */
  @Post('bulk-delete')
  async bulkDelete(@Body() body: { ids: string[] }) {
    if (!Array.isArray(body?.ids) || body.ids.length === 0) {
      return { deleted: 0, message: 'ids 不能为空' };
    }
    return this.knowledge.bulkDelete(body.ids);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string; category?: string; tags?: string[]; source?: string },
  ) {
    return this.knowledge.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.knowledge.delete(id);
  }
}
