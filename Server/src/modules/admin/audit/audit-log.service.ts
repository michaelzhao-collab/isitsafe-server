import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * V3-S3-7 Admin 审计日志服务
 *
 * 统一入口：所有 admin 写操作（禁用用户、撤回广播、发布情报、改 AI 设置等）
 * 必须 await this.audit.record(...) 落表，禁止再写 console.log。
 *
 * 设计原则：
 *  - 写失败不抛错（落表失败不应阻塞业务），仅 Logger.warn 出来
 *  - request 对象可选：传了则自动提取 ip + UA；不传则纯业务调用
 *  - before / after JSON 不限大小，但建议只放变更字段（避免大字段如 JSON blob）
 */
@Injectable()
export class AdminAuditLogService {
  private readonly logger = new Logger(AdminAuditLogService.name);
  constructor(private prisma: PrismaService) {}

  async record(params: {
    adminId: string;
    /** 操作 action，建议 namespace 格式：'user.disable' / 'family.broadcast.recall' */
    action: string;
    /** 目标类型：user / family_broadcast / intel_alert 等 */
    targetType?: string;
    /** 目标主键 id；可空（如全局配置变更） */
    targetId?: string;
    /** 操作前快照（部分字段即可） */
    before?: Record<string, unknown> | null;
    /** 操作后快照 */
    after?: Record<string, unknown> | null;
    /** Express request，自动提取 IP / UA */
    req?: { headers?: any; ip?: string; socket?: any };
  }): Promise<void> {
    const { ipAddress, userAgent } = this.extractMeta(params.req);
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          adminId: params.adminId,
          action: params.action.slice(0, 80),
          targetType: params.targetType?.slice(0, 40) ?? null,
          targetId: params.targetId ?? null,
          beforeValue: (params.before ?? null) as any,
          afterValue: (params.after ?? null) as any,
          ipAddress: ipAddress?.slice(0, 64) ?? null,
          userAgent: userAgent?.slice(0, 256) ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `[AuditLog] write failed for ${params.action}: ${err?.message ?? err}`,
      );
    }
  }

  private extractMeta(req?: { headers?: any; ip?: string; socket?: any }): {
    ipAddress?: string;
    userAgent?: string;
  } {
    if (!req) return {};
    const xff = req.headers?.['x-forwarded-for'];
    const fromXff =
      typeof xff === 'string'
        ? xff.split(',')[0].trim()
        : Array.isArray(xff)
          ? xff[0]
          : undefined;
    const ip = fromXff || req.ip || req.socket?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return {
      ipAddress: typeof ip === 'string' ? ip : undefined,
      userAgent: typeof ua === 'string' ? ua : undefined,
    };
  }
}
