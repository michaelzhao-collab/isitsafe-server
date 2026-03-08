import { IsString, IsOptional, IsEmail, Matches } from 'class-validator';

export class LoginPhoneDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'Invalid phone number' })
  phone: string;

  @IsString()
  @IsOptional()
  code?: string;
}

export class LoginEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  code?: string;
}

export class LoginSmsDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'Invalid phone number' })
  phone: string;

  @IsString()
  smsCode: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
