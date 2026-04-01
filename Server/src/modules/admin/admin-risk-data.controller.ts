import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { normalizeContent } from '../../common/utils/normalize';

const QUERY_CACHE_PREFIX = 'query:';

@Controller('admin/risk-data')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminRiskDataController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private async invalidateQueryCache(type: string, content: string) {
    try {
      await this.redis.del(`${QUERY_CACHE_PREFIX}${type}:${content}`);
      // 同时尝试删除规范化后的 key
      const norm = normalizeContent(content);
      if (norm && norm !== content) {
        await this.redis.del(`${QUERY_CACHE_PREFIX}${type}:${norm}`);
      }
    } catch {
      // Redis 不可用时忽略
    }
  }

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('type') type?: string,
    @Query('riskLevel') riskLevel?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const skip = (pageNum - 1) * size;
    const where: any = {};
    if (type) where.type = type;
    if (riskLevel) where.riskLevel = riskLevel;

    const [items, total] = await Promise.all([
      this.prisma.riskData.findMany({
        where,
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.riskData.count({ where }),
    ]);
    return { items, total, page: pageNum, pageSize: size };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.prisma.riskData.findUniqueOrThrow({ where: { id } });
  }

  @Post()
  async create(
    @Body()
    body: {
      type: string;
      content: string;
      riskLevel: string;
      riskCategory?: string | null;
      source?: string | null;
      evidence?: string | null;
      tags?: string[] | unknown;
    },
  ) {
    const type = body.type?.trim();
    const content = body.content?.trim();
    const riskLevel = body.riskLevel?.trim()?.toLowerCase();
    if (!type || !content || !riskLevel) {
      throw new BadRequestException('type/content/riskLevel 为必填');
    }
    if (!['high', 'medium', 'low'].includes(riskLevel)) {
      throw new BadRequestException('riskLevel 必须为 high/medium/low');
    }
    const tagsArr =
      Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [];

    const record = await this.prisma.riskData.create({
      data: {
        type,
        content,
        riskLevel,
        riskCategory: body.riskCategory ?? null,
        source: body.source ?? null,
        evidence: body.evidence ?? null,
        tags: tagsArr as any,
      },
    });
    await this.invalidateQueryCache(type, content);
    return record;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      type?: string;
      content?: string;
      riskLevel?: string;
      riskCategory?: string | null;
      source?: string | null;
      evidence?: string | null;
      tags?: string[] | unknown;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (body.type !== undefined) data.type = body.type?.trim();
    if (body.content !== undefined) data.content = body.content?.trim();
    if (body.riskLevel !== undefined) data.riskLevel = body.riskLevel?.trim()?.toLowerCase();
    if (body.riskCategory !== undefined) data.riskCategory = body.riskCategory ?? null;
    if (body.source !== undefined) data.source = body.source ?? null;
    if (body.evidence !== undefined) data.evidence = body.evidence ?? null;
    if (body.tags !== undefined) {
      const tagsArr = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [];
      data.tags = tagsArr as any;
    }

    const rl = data.riskLevel as string | undefined;
    if (rl && !['high', 'medium', 'low'].includes(rl)) {
      throw new BadRequestException('riskLevel 必须为 high/medium/low');
    }
    const c = data.content as string | undefined;
    if (c !== undefined && !c.trim()) {
      throw new BadRequestException('content 不能为空');
    }

    // 轻量校验：URL 类型时 content 为空格/协议清理后仍应有内容
    if ((data.type as string | undefined) === 'url' && c) {
      const norm = normalizeContent(c);
      if (!norm) throw new BadRequestException('URL 内容无效');
    }

    const existing = await this.prisma.riskData.findUnique({ where: { id } });
    await this.prisma.riskData.update({
      where: { id },
      data: data as any,
    });
    if (existing) {
      await this.invalidateQueryCache(existing.type, existing.content);
      if (data.content && data.content !== existing.content) {
        await this.invalidateQueryCache((data.type as string | undefined) ?? existing.type, data.content as string);
      }
    }
    return { success: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const existing = await this.prisma.riskData.findUnique({ where: { id } });
    await this.prisma.riskData.delete({ where: { id } });
    if (existing) {
      await this.invalidateQueryCache(existing.type, existing.content);
    }
    return { success: true };
  }
}

