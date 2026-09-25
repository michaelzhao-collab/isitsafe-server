import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { QueryService } from './query.service';
import { isImCapableRequest } from '../../common/app-version.util';
import { QuotaService, QuotaSnapshot } from '../quota/quota.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CompanyQueryDto, PhoneQueryDto, UrlQueryDto } from './dto/query.dto';

@Controller('query')
@UseGuards(OptionalJwtAuthGuard)
export class QueryController {
  constructor(
    private query: QueryService,
    private quota: QuotaService,
  ) {}

  // 入参改走 DTO（2026-09-07 复核修复）：原来是 @Body('content') 裸取值，
  // 空串 / "1" / "+86" 会让风险库 contains 退化成全表匹配，见 dto/query.dto.ts。
  @Post('phone')
  async phone(
    @Body() dto: PhoneQueryDto,
    @CurrentUser('sub') userId?: string,
    @Headers('x-app-version') appVersion?: string,
  ) {
    const imCapable = isImCapableRequest(appVersion);
    return this.runWithQuota(userId, () => this.query.queryPhone(dto.content, userId, imCapable));
  }

  @Post('url')
  async url(
    @Body() dto: UrlQueryDto,
    @CurrentUser('sub') userId?: string,
    @Headers('x-app-version') appVersion?: string,
  ) {
    const imCapable = isImCapableRequest(appVersion);
    return this.runWithQuota(userId, () => this.query.queryUrl(dto.content, userId, imCapable));
  }

  @Post('company')
  async company(@Body() dto: CompanyQueryDto, @CurrentUser('sub') userId?: string) {
    return this.runWithQuota(userId, () => this.query.queryCompany(dto.content, userId));
  }

  @Get('tags')
  async tags() {
    return this.query.getTags();
  }

  /**
   * 统一配额包装：
   *   - 未登录：直接放行（fall back 到 throttler 防刷；用户级配额仅对登录用户生效）
   *   - 登录：原子占用一次配额；不够直接 429；业务抛错则退还，不白扣次数
   *
   * 2026-09-07 复核修复：原来是 checkQueryQuota() → 业务 → incrementQueryCount() 三步，
   * check 与 increment 之间有并发窗口，同时打 6 个请求可以突破 5 次/天上限。
   * 现在改为先原子 INCR 占位（reserveQueryQuota），失败路径显式退还。
   */
  private async runWithQuota<T>(
    userId: string | undefined,
    handler: () => Promise<T>,
  ): Promise<T & { quota?: QuotaSnapshot }> {
    if (!userId) {
      const result = await handler();
      return result as T & { quota?: QuotaSnapshot };
    }

    const snapshot = await this.quota.reserveQueryQuota(userId);
    if (!snapshot.allowed) {
      throw new HttpException(
        {
          message: 'daily_query_limit_exceeded',
          quota: serializeQuota(snapshot),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let result: T;
    try {
      result = await handler();
    } catch (err) {
      // 业务失败不该扣用户次数（与修改前的语义保持一致）
      await this.quota.refundQueryQuota(userId);
      throw err;
    }
    return {
      ...(result as object),
      quota: serializeQuota(snapshot),
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
