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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'secret'),
    });
  }

  async validate(payload: { sub: string; role?: string }) {
    try {
      // 只查 id、role，避免未执行迁移时因缺少 wechat_nickname 等列报错
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true },
      });
      if (!user) throw new UnauthorizedException('用户不存在或已失效');
      return { sub: user.id, role: user.role };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error('JWT validate failed', err);
      throw new InternalServerErrorException('服务暂时异常，请稍后重试');
    }
  }
}
