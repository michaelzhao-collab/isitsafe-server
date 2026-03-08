import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

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
  ) {
    return this.knowledge.list(
      category,
      parseInt(page || '1', 10),
      parseInt(pageSize || '20', 10),
      search,
      language || 'zh',
    );
  }

  @Get(':id')
  @Public()
  async getById(@Param('id') id: string) {
    return this.knowledge.getById(id);
  }
}
