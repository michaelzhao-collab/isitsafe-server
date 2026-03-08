/**
 * Admin 路由必须校验 role 为 admin 或 superadmin
 * 与 JwtAuthGuard 一起使用：UseGuards(JwtAuthGuard, AdminRoleGuard)
 */
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowed = ['ADMIN', 'SUPERADMIN'];
    const roles = requiredRoles?.length ? requiredRoles : allowed;
    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) return false;
    return roles.includes(user.role);
  }
}
