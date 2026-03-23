import { Controller, Post, Get, Body, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  LoginEmailDto,
  RefreshTokenDto,
  SendSmsCodeDto,
  AppleLoginDto,
  SocialLoginDto,
} from './dto/login.dto';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private auth: AuthService) {}

  /** 统一登录：手机为 E.164 + smsCode（或 code）123456；邮箱登录逻辑不变 */
  @Public()
  @Post('login')
  async login(
    @Body() body: { phone?: string; email?: string; code?: string; smsCode?: string },
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    if (body.phone) {
      return this.auth.loginPhone(
        { phone: body.phone, code: body.code, smsCode: body.smsCode },
        ip,
      );
    }
    if (body.email) return this.auth.loginEmail({ email: body.email, code: body.code }, ip);
    throw new UnauthorizedException('请提供 phone 或 email');
  }

  /** 模拟发短信：同一号码 5 分钟 1 次，返回固定验证码文案 */
  @Public()
  @Post('send-sms-code')
  async sendSmsCode(@Body() dto: SendSmsCodeDto) {
    return this.auth.sendSmsCode(dto.phone);
  }

  /** Apple 登录：客户端传 identityToken，服务端校验后签发本系统 token */
  @Public()
  @Post('apple/login')
  async appleLogin(@Body() dto: AppleLoginDto) {
    return this.auth.loginApple(dto);
  }

  /** 统一第三方登录入口（当前支持 apple；google 预留） */
  @Public()
  @Post('social/login')
  async socialLogin(@Body() dto: SocialLoginDto) {
    return this.auth.loginSocial(dto);
  }

  /** 默认国家码提示（无定位权限）；优先 CDN 头，否则客户端用 Locale / IP */
  @Public()
  @Get('region-hint')
  regionHint(@Req() req: any) {
    return this.auth.regionHint(req);
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
