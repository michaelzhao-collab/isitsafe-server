import { BadRequestException, Body, Controller, Ip, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAuthService } from './admin-auth.service';
import { TurnstileService } from './turnstile.service';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private adminAuth: AdminAuthService,
    private turnstile: TurnstileService,
  ) {}

  /** 管理后台登录：账号 + 密码 + Cloudflare Turnstile 人机验证 */
  @Public()
  @Post('login')
  async login(
    @Body() body: { username: string; password: string; turnstileToken?: string },
    @Ip() ip: string,
  ) {
    if (!body.username?.trim() || !body.password) {
      throw new BadRequestException('请填写用户名和密码');
    }
    // 人机验证（未配置 TURNSTILE_SECRET 时跳过，兼容当前未启用 Turnstile 的环境）
    await this.turnstile.verify(body.turnstileToken, ip);
    return this.adminAuth.login(body.username.trim(), body.password);
  }

  /** 修改当前登录管理员的密码 */
  @Post('change-password')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException('请填写当前密码和新密码');
    }
    return this.adminAuth.changePassword(userId, body.currentPassword, body.newPassword);
  }
}
