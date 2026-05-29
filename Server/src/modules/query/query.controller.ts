import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { QueryService } from './query.service';
import { QuotaService, QuotaSnapshot } from '../quota/quota.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('query')
@UseGuards(OptionalJwtAuthGuard)
export class QueryController {
  constructor(
    private query: QueryService,
    private quota: QuotaService,
  ) {}

  @Post('phone')
  async phone(@Body('content') content: string, @CurrentUser('sub') userId?: string) {
    return this.runWithQuota(userId, () => this.query.queryPhone(content, userId));
  }

  @Post('url')
  async url(@Body('content') content: string, @CurrentUser('sub') userId?: string) {
    return this.runWithQuota(userId, () => this.query.queryUrl(content, userId));
  }

  @Post('company')
  async company(@Body('content') content: string, @CurrentUser('sub') userId?: string) {
    return this.runWithQuota(userId, () => this.query.queryCompany(content, userId));
  }

  @Get('tags')
  async tags() {
    return this.query.getTags();
  }

  /**
   * 统一配额包装：
   *   - 未登录：直接放行（fall back 到 throttler 防刷；用户级配额仅对登录用户生效）
   *   - 登录：先 check；不够直接 429；够则执行业务后 increment，注入 quota 返回前端
   *
   * 注意：把 increment 放在业务成功 **之后**，避免业务 throw 时白白扣配额。
   */
  private async runWithQuota<T>(
    userId: string | undefined,
    handler: () => Promise<T>,
  ): Promise<T & { quota?: QuotaSnapshot }> {
    if (!userId) {
      const result = await handler();
      return result as T & { quota?: QuotaSnapshot };
    }

    const snapshot = await this.quota.checkQueryQuota(userId);
    if (!snapshot.allowed) {
      throw new HttpException(
        {
          message: 'daily_query_limit_exceeded',
          quota: serializeQuota(snapshot),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await handler();
    const finalSnapshot = await this.quota.incrementQueryCount(userId);
    return {
      ...(result as object),
      quota: serializeQuota(finalSnapshot),
    } as T & { quota?: QuotaSnapshot };
  }
}

/// JSON 不能编码 Infinity；前端约定：unlimited 用户 limit/remaining 返回 -1
function serializeQuota(s: QuotaSnapshot) {
  return {
    allowed: s.allowed,
    count: s.count,
    limit: s.isUnlimited ? -1 : s.limit,
    remaining: s.isUnlimited ? -1 : s.remaining,
    isUnlimited: s.isUnlimited,
    source: s.source,
  };
}
