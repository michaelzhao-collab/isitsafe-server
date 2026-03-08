import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

@Injectable()
export class AdminAuthService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  /**
   * 管理后台登录：仅支持 username + password，且该用户须为 ADMIN 或 SUPERADMIN
   */
  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        username: username.trim(),
        role: { in: [UserRole.ADMIN, UserRole.SUPERADMIN] },
      },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return this.auth.issueTokensForUser({ id: user.id, role: user.role });
  }

  /**
   * 修改当前管理员密码（需旧密码校验）
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('该账号未设置密码，无法修改');
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('当前密码错误');
    }
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
    return { success: true };
  }
}
