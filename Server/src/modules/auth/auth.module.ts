import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GeoIpService } from './geoip.service';
import { getJwtSecret } from '../../common/jwt-secret.util';
import { MailModule } from '../mail/mail.module';
import { EmailCodeService } from './email-code.service';

@Module({
  imports: [
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GeoIpService, EmailCodeService],
  exports: [AuthService, GeoIpService],
})
export class AuthModule {}
