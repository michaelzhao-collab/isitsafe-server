import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LoginPhoneDto, LoginEmailDto, LoginSmsDto, RefreshTokenDto } from './dto/login.dto';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private auth: AuthService) {}

  /** 统一登录：body 传 phone 或 email（MVP mock，不校验验证码） */
  @Public()
  @Post('login')
  async login(
    @Body() body: { phone?: string; email?: string; code?: string; smsCode?: string },
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    if (body.phone) return this.auth.loginPhone({ phone: body.phone, code: body.code }, ip);
    if (body.email) return this.auth.loginEmail({ email: body.email, code: body.code }, ip);
    if (body.smsCode && body.phone) return this.auth.loginSms({ phone: body.phone, smsCode: body.smsCode }, ip);
    return this.auth.login(body, ip);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser('sub') userId: string) {
    return this.auth.logout(userId);
  }

  @Get('userinfo')
  @UseGuards(JwtAuthGuard)
  async userinfo(@CurrentUser('sub') userId: string) {
    return this.auth.getUserInfo(userId);
  }

  @Public()
  @Post('refresh-token')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshToken(dto.refreshToken);
  }
}
