import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BreachService } from './breach.service';
import { IsEmail, IsString, MaxLength } from 'class-validator';

class AddTargetDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

class VerifyTargetDto {
  @IsString()
  token!: string;
}

/**
 * V3-F 暗网监控接口（仅海外用户）
 * 路由前缀：/api/v3/breach
 */
@Controller('v3/breach')
@UseGuards(JwtAuthGuard)
export class BreachController {
  constructor(private breach: BreachService) {}

  /** 添加监控目标（一期 stub：自动验证 + 立即扫描） */
  @Post('targets')
  async addTarget(@CurrentUser('sub') userId: string, @Body() dto: AddTargetDto) {
    return this.breach.addTarget(userId, dto.email);
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
  ) {
    return this.breach.verifyTarget(userId, id, dto.token);
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
