import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';

@Controller('admin/membership')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminMembershipController {
  constructor(private prisma: PrismaService) {}

  @Get('plans')
  async list() {
    return this.prisma.membershipPlan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Post('plans')
  async create(
    @Body()
    body: {
      name: string;
      productId: string;
      price: number;
      currency: string;
      period: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
      isRecommended?: boolean;
    },
  ) {
    const plan = await this.prisma.membershipPlan.create({
      data: {
        name: body.name,
        productId: body.productId,
        price: body.price,
        currency: body.currency ?? 'CNY',
        period: body.period,
        description: body.description ?? null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
        isRecommended: body.isRecommended ?? false,
      },
    });
    return plan;
  }

  @Put('plans/:id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      productId?: string;
      price?: number;
      currency?: string;
      period?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
      isRecommended?: boolean;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.productId !== undefined) data.productId = body.productId;
    if (body.price !== undefined) data.price = body.price;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.period !== undefined) data.period = body.period;
    if (body.description !== undefined) data.description = body.description;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
    if (body.isRecommended !== undefined) data.isRecommended = body.isRecommended;

    return this.prisma.membershipPlan.update({
      where: { id },
      data: data as any,
    });
  }

  @Delete('plans/:id')
  async delete(@Param('id') id: string) {
    await this.prisma.membershipPlan.delete({ where: { id } });
    return { success: true };
  }
}
