/**
 * V4-P1 冷启动引导 chips 服务
 *
 * iOS 首次启动后从 GET /api/onboarding/chips 拉取可点 chips
 * tap chip → 按 actionType 分发：text 自动发送 / image|camera|voice 触发 UI 动作 / url 跳页
 *
 * admin 可热更，无需发 iOS 版本
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ChipPublicView {
  id: string;
  orderIdx: number;
  label: string;          // 按 language 取
  iconType: string;
  actionType: string;
  actionPayload: string | null;
}

export interface ChipAdminUpsertInput {
  orderIdx?: number;
  labelZh: string;
  labelEn: string;
  iconType?: string;
  actionType: string;
  actionPayloadZh?: string | null;
  actionPayloadEn?: string | null;
  status?: 'active' | 'archived';
}

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  /** iOS 端调：仅返 active，按 orderIdx 升序，按语言取对应字段 */
  async listPublic(language: 'zh' | 'en'): Promise<ChipPublicView[]> {
    const rows = await this.prisma.onboardingChip.findMany({
      where: { status: 'active' },
      orderBy: [{ orderIdx: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      orderIdx: r.orderIdx,
      label: language === 'en' ? r.labelEn : r.labelZh,
      iconType: r.iconType,
      actionType: r.actionType,
      actionPayload: language === 'en' ? r.actionPayloadEn : r.actionPayloadZh,
    }));
  }

  /** admin 列表：返完整字段（zh + en），支持筛 status */
  async listAdmin(status?: string) {
    return this.prisma.onboardingChip.findMany({
      where: status ? { status } : {},
      orderBy: [{ orderIdx: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(input: ChipAdminUpsertInput) {
    return this.prisma.onboardingChip.create({
      data: {
        orderIdx: input.orderIdx ?? 0,
        labelZh: input.labelZh.slice(0, 80),
        labelEn: input.labelEn.slice(0, 120),
        iconType: (input.iconType ?? 'message.fill').slice(0, 40),
        actionType: input.actionType.slice(0, 20),
        actionPayloadZh: input.actionPayloadZh ?? null,
        actionPayloadEn: input.actionPayloadEn ?? null,
        status: input.status ?? 'active',
      },
    });
  }

  async update(id: string, input: Partial<ChipAdminUpsertInput>) {
    const exists = await this.prisma.onboardingChip.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('chip 不存在');
    return this.prisma.onboardingChip.update({
      where: { id },
      data: {
        ...(input.orderIdx !== undefined && { orderIdx: input.orderIdx }),
        ...(input.labelZh && { labelZh: input.labelZh.slice(0, 80) }),
        ...(input.labelEn && { labelEn: input.labelEn.slice(0, 120) }),
        ...(input.iconType && { iconType: input.iconType.slice(0, 40) }),
        ...(input.actionType && { actionType: input.actionType.slice(0, 20) }),
        ...(input.actionPayloadZh !== undefined && { actionPayloadZh: input.actionPayloadZh }),
        ...(input.actionPayloadEn !== undefined && { actionPayloadEn: input.actionPayloadEn }),
        ...(input.status && { status: input.status }),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.onboardingChip.delete({ where: { id } });
  }
}
