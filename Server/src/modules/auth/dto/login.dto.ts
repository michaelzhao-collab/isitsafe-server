import { IsString, IsOptional, IsEmail, Matches } from 'class-validator';

/** E.164：+ 与国家码，总数字 7～15 位（不含 +） */
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export class LoginPhoneDto {
  @IsString()
  @Matches(E164_REGEX, { message: 'Invalid phone number' })
  phone: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  smsCode?: string;
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
  @Matches(E164_REGEX, { message: 'Invalid phone number' })
  phone: string;

  @IsString()
  smsCode: string;
}

export class SendSmsCodeDto {
  @IsString()
  @Matches(E164_REGEX, { message: 'Invalid phone number' })
  phone: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
