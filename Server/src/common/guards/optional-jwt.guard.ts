/**
 * 可选 JWT：有 token 则校验并注入 user，无 token 则放行（user 为 undefined）
 * 用于 /api/ai/analyze 等“未登录也能问”的接口
 */
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    // 有错或没 user 也不抛，让后续逻辑拿到 undefined
    return user ?? null;
  }
}
