import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IntelService } from './intel.service';
import { IntelSubmitDto, IntelPreferencesDto } from './dto/intel.dto';

/**
 * V3-B 情报推送接口
 * 路由前缀：/api/v3/intel
 *
 * - GET  /feed             用户的情报 feed（按 region + audience 过滤）
 * - GET  /:id              详情（自动标已读）
 * - GET  /categories       分类列表（偏好设置选项）
 * - GET  /unread-count     未读数（首页通知条用）
 * - POST /submit           用户上报
 * - PUT  /preferences      更新偏好
 * - GET  /preferences      获取偏好
 */
@Controller('v3/intel')
export class IntelController {
  constructor(private intel: IntelService) {}

  // ⚠️ 路由顺序：所有静态路径（feed / categories / unread-count / submit / me/* / preferences）
  // 必须在 `:id` 之前声明，否则会被 `:id` 捕获，把 "preferences" 当 intelId 解析后返回 NotFound。
  @Get('feed')
  @UseGuards(JwtAuthGuard)
  async feed(
    @CurrentUser('sub') userId: string,
    @Query('limit') limitQ?: string,
    @Query('language') language?: string,
  ) {
    return this.intel.getFeedForUser(userId, {
      language,
      limit: limitQ ? parseInt(limitQ, 10) : 30,
    });
  }

  @Get('categories')
  async categories(@Query('language') language?: string) {
    return this.intel.getCategories(language || 'zh');
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async unreadCount(@CurrentUser('sub') userId: string) {
    const count = await this.intel.getUnreadCountForUser(userId);
    return { count };
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  async submit(@CurrentUser('sub') userId: string, @Body() dto: IntelSubmitDto) {
    const result = await this.intel.submit(userId, dto);
    return { id: result.id, status: result.status };
  }

  @Get('me/submissions')
  @UseGuards(JwtAuthGuard)
  async mySubmissions(@CurrentUser('sub') userId: string) {
    return this.intel.getMySubmissions(userId);
  }

  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  async getPreferences(@CurrentUser('sub') userId: string) {
    return this.intel.getPreferences(userId);
  }

  @Put('preferences')
  @UseGuards(JwtAuthGuard)
  async putPreferences(@CurrentUser('sub') userId: string, @Body() dto: IntelPreferencesDto) {
    return this.intel.updatePreferences(userId, dto);
  }

  // 必须放最后：动态路径
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async detail(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.intel.getDetail(userId, id);
  }
}

/**
 * V3-B Admin 情报管理接口
 * 仅管理员可访问；路由前缀 /api/admin/intel
 */
@Controller('admin/intel')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class IntelAdminController {
  constructor(private intel: IntelService) {}

  @Get('alerts')
  async listAlerts(
    @Query('status') status?: string,
    @Query('language') language?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.intel.adminListAlerts({
      status,
      language,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post('alerts')
  async createAlert(@Body() body: any) {
    return this.intel.adminCreateAlert(this.pickAdminAlertFields(body));
  }

  @Put('alerts/:id')
  async updateAlert(@Param('id') id: string, @Body() body: any) {
    return this.intel.adminUpdateAlert(id, this.pickAdminAlertFields(body, true));
  }

  /** admin alert 字段白名单，防止 publishedAt / createdAt / id 等被任意覆盖 */
  private pickAdminAlertFields(b: any, partial = false): any {
    const out: any = {};
    const keys = [
      'title', 'summary', 'contentBlocks', 'category', 'severity',
      'targetRegions', 'targetAudiences', 'language', 'sourceUrl', 'status',
    ];
    for (const k of keys) {
      if (partial) {
        if (b[k] !== undefined) out[k] = b[k];
      } else {
        out[k] = b[k];
      }
    }
    return out;
  }

  @Delete('alerts/:id')
  async deleteAlert(@Param('id') id: string) {
    return this.intel.adminDeleteAlert(id);
  }

  @Get('submissions')
  async listSubmissions(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.intel.adminListSubmissions({
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post('submissions/:id/review')
  async reviewSubmission(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject' | 'merge'; mergedToIntelId?: string },
  ) {
    return this.intel.adminReviewSubmission(id, body.action, body.mergedToIntelId);
  }
}
