import { Controller, Get, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ReportService } from '../report/report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportStatus } from '@prisma/client';

@Controller('admin/reports')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminReportsController {
  constructor(private report: ReportService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: ReportStatus,
  ) {
    return this.report.list(parseInt(page || '1', 10), parseInt(pageSize || '20', 10), status);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ReportStatus },
    @CurrentUser('sub') adminId: string,
  ) {
    return this.report.updateStatus(id, body.status, adminId);
  }

  @Get('stats')
  async stats() {
    return this.report.getStats();
  }
}
