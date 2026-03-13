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
