import { Injectable, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector, private prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    // 1) JWT 签名校验
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;
    // 2) 被禁用账号拦截（极少数被封号用户每请求多 1 次 user.findUnique；可后续加缓存）
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req?.user?.sub || req?.user?.userId || req?.user?.id;
    if (!userId) return true; // 解析不出 user.sub（例外路径）就放行交给业务层处理
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isDisabled: true, disabledReason: true },
    });
    if (u?.isDisabled) {
      throw new ForbiddenException({
        code: 'account_disabled',
        message: u.disabledReason || '账号已被禁用，请联系客服',
      });
    }
    return true;
  }
}
