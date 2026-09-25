import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { getJwtSecret } from '../../../common/jwt-secret.util';
import {
  isIssuedBeforeRevocation,
  revokedBeforeKey,
} from '../../../common/token-revocation.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: { sub: string; role?: string; iat?: number }) {
    try {
      // 只查 id、role，避免未执行迁移时因缺少 wechat_nickname 等列报错
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true },
      });
      if (!user) throw new UnauthorizedException('用户不存在或已失效');
      // 2026-09-07 复核修复：登出 / 注销后，此刻之前签发的 access token 立即作废
      if (await this.isRevoked(payload.sub, payload.iat)) {
        throw new UnauthorizedException('登录状态已失效，请重新登录');
      }
      return { sub: user.id, role: user.role };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error('JWT validate failed', err);
      throw new InternalServerErrorException('服务暂时异常，请稍后重试');
    }
  }

  /**
   * 查吊销名单。Redis 不可用时 **放行**：
   * 宁可让已登出的 token 多活一会儿，也不能因 Redis 抖动把全站用户挡在门外。
   */
  private async isRevoked(userId: string, iat?: number): Promise<boolean> {
    if (!iat) return false;
    try {
      const raw = await this.redis.get(revokedBeforeKey(userId));
      return isIssuedBeforeRevocation(iat, raw);
    } catch (e) {
      this.logger.warn(
        `[TokenRevocation] Redis 不可用，放行该请求：${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }
}
