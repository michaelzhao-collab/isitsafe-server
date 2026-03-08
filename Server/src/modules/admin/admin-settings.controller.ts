import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminSettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  async get() {
    return this.settings.getForAdmin();
  }

  /** 仅 superadmin 可修改 */
  @Put()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN')
  async update(
    @Body()
    body: {
      defaultProvider?: string;
      doubaoKey?: string | null;
      openaiKey?: string | null;
      aiBaseUrl?: string | null;
    },
  ) {
    return this.settings.updateForAdmin(body);
  }
}
