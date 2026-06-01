/**
 * V4-P1 冷启动 chips API
 *
 * 公开：GET /api/onboarding/chips?language=zh|en
 * Admin：CRUD /api/admin/onboarding/chips
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { Public } from '../../common/decorators/public.decorator';
import { OnboardingService, ChipAdminUpsertInput } from './onboarding.service';

function resolveLanguage(header?: string, query?: string): 'zh' | 'en' {
  if (query === 'en' || query === 'zh') return query;
  if (header?.toLowerCase().startsWith('en')) return 'en';
  return 'zh';
}

@Controller('onboarding')
export class OnboardingPublicController {
  constructor(private svc: OnboardingService) {}

  /** iOS 拉取（无需登录） */
  @Get('chips')
  @Public()
  async list(
    @Query('language') language?: string,
    @Headers('x-app-language') langHeader?: string,
  ) {
    return this.svc.listPublic(resolveLanguage(langHeader, language));
  }
}

@Controller('admin/onboarding')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class OnboardingAdminController {
  constructor(private svc: OnboardingService) {}

  @Get('chips')
  async list(@Query('status') status?: string) {
    return this.svc.listAdmin(status);
  }

  @Post('chips')
  async create(@Body() body: ChipAdminUpsertInput) {
    return this.svc.create(body);
  }

  @Put('chips/:id')
  async update(@Param('id') id: string, @Body() body: Partial<ChipAdminUpsertInput>) {
    return this.svc.update(id, body);
  }

  @Delete('chips/:id')
  async delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
