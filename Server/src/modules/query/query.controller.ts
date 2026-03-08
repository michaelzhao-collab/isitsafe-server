import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { QueryService } from './query.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('query')
@UseGuards(OptionalJwtAuthGuard)
export class QueryController {
  constructor(private query: QueryService) {}

  @Post('phone')
  async phone(@Body('content') content: string, @CurrentUser('sub') userId?: string) {
    return this.query.queryPhone(content, userId);
  }

  @Post('url')
  async url(@Body('content') content: string, @CurrentUser('sub') userId?: string) {
    return this.query.queryUrl(content, userId);
  }

  @Post('company')
  async company(@Body('content') content: string, @CurrentUser('sub') userId?: string) {
    return this.query.queryCompany(content, userId);
  }

  @Get('tags')
  async tags() {
    return this.query.getTags();
  }
}
