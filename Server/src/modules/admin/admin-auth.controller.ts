import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminAuthService } from './admin-auth.service';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private adminAuth: AdminAuthService) {}

  /** 管理后台登录：账号 + 密码，与 C 端手机号+验证码分离 */
  @Public()
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    if (!body.username?.trim() || !body.password) {
      throw new BadRequestException('请填写用户名和密码');
    }
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
