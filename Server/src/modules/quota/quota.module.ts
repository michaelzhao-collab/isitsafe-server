import { Module } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';
import { QuotaService } from './quota.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * V3-S1-4 查询配额 + 权益分发
 *
 *   EntitlementService：单一权益判定（free / personal_pro / family_owner / family_member）
 *   QuotaService：Redis 计数 + 拦截/通过
 *
 * 被 query / family 等模块 inject 使用；RedisModule 已 @Global() 无需显式导入。
 */
@Module({
  imports: [PrismaModule],
  providers: [EntitlementService, QuotaService],
  exports: [EntitlementService, QuotaService],
})
export class QuotaModule {}
