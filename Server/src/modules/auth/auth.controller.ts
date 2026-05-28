import { Controller, Post, Get, Body, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  LoginEmailDto,
  RefreshTokenDto,
  AppleLoginDto,
  SocialLoginDto,
} from './dto/login.dto';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private auth: AuthService) {}

  /** 统一登录/注册：手机号 + 密码（>= 8 位），新用户自动注册；邮箱登录保留为内部兜底 */
  @Public()
  @Post('login')
  async login(
    @Body() body: { phone?: string; email?: string; password?: string; code?: string; smsCode?: string },
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    if (body.phone) {
      return this.auth.loginPhone(
        { phone: body.phone, password: body.password, code: body.code, smsCode: body.smsCode },
        ip,
        req,
      );
    }
    if (body.email) return this.auth.loginEmail({ email: body.email, code: body.code }, ip, req);
    throw new UnauthorizedException('请提供 phone 或 email');
  }

  /** Apple 登录：客户端传 identityToken，服务端校验后签发本系统 token */
  @Public()
  @Post('apple/login')
  async appleLogin(@Body() dto: AppleLoginDto, @Req() req: any) {
    return this.auth.loginApple(dto, req);
  }

  /** 统一第三方登录入口（当前支持 apple；google 预留） */
  @Public()
  @Post('social/login')
  async socialLogin(@Body() dto: SocialLoginDto, @Req() req: any) {
    return this.auth.loginSocial(dto, req);
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

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@CurrentUser('sub') userId: string) {
    return this.auth.deleteAccount(userId);
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
