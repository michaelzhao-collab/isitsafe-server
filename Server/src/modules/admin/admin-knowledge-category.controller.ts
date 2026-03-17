import { Body, Controller, Get, Post, Put, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('admin/knowledge-categories')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminKnowledgeCategoryController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Query('includeOffline') includeOffline?: string) {
    const where = includeOffline === 'true' ? {} : { status: 'active' };
    return this.prisma.knowledgeCategoryConfig.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Post()
  async create(
    @Body()
    body: {
      key: string;
      nameZh: string;
      nameEn: string;
      sortOrder?: number;
      status?: string;
    },
  ) {
    const { key, nameZh, nameEn, sortOrder, status } = body;
    return this.prisma.knowledgeCategoryConfig.create({
      data: {
        key: key.trim(),
        nameZh: nameZh.trim(),
        nameEn: nameEn.trim(),
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        status: status === 'offline' ? 'offline' : 'active',
      },
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      nameZh?: string;
      nameEn?: string;
      sortOrder?: number;
      status?: string;
    },
  ) {
    const data: any = {};
    if (body.nameZh !== undefined) data.nameZh = body.nameZh.trim();
    if (body.nameEn !== undefined) data.nameEn = body.nameEn.trim();
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;
    if (body.status === 'active' || body.status === 'offline') data.status = body.status;
    return this.prisma.knowledgeCategoryConfig.update({
      where: { id },
      data,
    });
  }

  /** 只允许删除未使用的分类；MVP 先做硬删 */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.knowledgeCategoryConfig.delete({ where: { id } });
    return { success: true };
  }

  /** 仅更新状态：上架/下架 */
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: 'active' | 'offline' }) {
    const status = body.status === 'offline' ? 'offline' : 'active';
    return this.prisma.knowledgeCategoryConfig.update({
      where: { id },
      data: { status },
    });
  }
}

