import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('report')
@UseGuards(OptionalJwtAuthGuard)
export class ReportController {
  constructor(private report: ReportService) {}

  @Post()
  async create(
    @Body('type') type: string,
    @Body('content') content: string,
    @Body('relatedQueryId') relatedQueryId?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.report.create(userId ?? null, type, content, relatedQueryId);
  }
}
