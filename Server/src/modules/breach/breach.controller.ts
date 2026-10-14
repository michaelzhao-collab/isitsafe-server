import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { headerLanguage } from '../../common/i18n/language.util';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OverseaOnlyGuard } from '../../common/guards/oversea-only.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BreachService } from './breach.service';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

class AddTargetDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

class VerifyTargetDto {
  /** 邮件里的 6 位验证码（兼容旧字段名 token） */
  @IsOptional() @IsString() @MaxLength(12)
  code?: string;
  @IsOptional() @IsString() @MaxLength(64)
  token?: string;
}

const langOf = (h?: string) => (headerLanguage(h) === 'zh' ? 'zh' : 'en') as 'zh' | 'en';

/**
 * V3-F 数据泄露监控接口（仅海外用户；原名「暗网监控」，2026-10-14 改名）
 * 路由前缀：/api/v3/breach
 */
@Controller('v3/breach')
@UseGuards(JwtAuthGuard, OverseaOnlyGuard)
export class BreachController {
  constructor(private breach: BreachService) {}

  /** 添加监控目标：登录邮箱直接监控；其它邮箱发验证码（2026-10-14） */
  @Post('targets')
  async addTarget(@CurrentUser('sub') userId: string, @Body() dto: AddTargetDto, @Headers('x-app-language') lang?: string) {
    return this.breach.addTarget(userId, dto.email, langOf(lang));
  }

  @Get('targets')
  async listTargets(@CurrentUser('sub') userId: string) {
    return this.breach.listTargets(userId);
  }

  @Delete('targets/:id')
  async deleteTarget(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.breach.deleteTarget(userId, id);
  }

  @Post('targets/:id/verify')
  async verify(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: VerifyTargetDto,
    @Headers('x-app-language') lang?: string,
  ) {
    return this.breach.verifyTarget(userId, id, dto.code ?? dto.token ?? '', langOf(lang));
  }

  @Post('targets/:id/resend-code')
  async resendCode(@CurrentUser('sub') userId: string, @Param('id') id: string, @Headers('x-app-language') lang?: string) {
    return this.breach.resendCode(userId, id, langOf(lang));
  }

  @Get('alerts')
  async listAlerts(@CurrentUser('sub') userId: string) {
    return this.breach.listAlerts(userId);
  }

  @Put('alerts/:id/dismiss')
  async dismissAlert(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.breach.dismissAlert(userId, id);
  }
}
