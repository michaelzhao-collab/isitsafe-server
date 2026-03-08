import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { LoginPhoneDto, LoginEmailDto, LoginSmsDto } from './dto/login.dto';
export declare class AuthService {
    private prisma;
    private redis;
    private jwt;
    private config;
    constructor(prisma: PrismaService, redis: RedisService, jwt: JwtService, config: ConfigService);
    private get maxAttempts();
    private get lockMinutes();
    login(body: {
        phone?: string;
        email?: string;
        code?: string;
        smsCode?: string;
    }, ip?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    loginPhone(dto: LoginPhoneDto, ip?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    loginEmail(dto: LoginEmailDto, ip?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    loginSms(dto: LoginSmsDto, ip?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    recordFailedLogin(identifier: string): Promise<void>;
    private checkLock;
    private clearAttempts;
    private recordLogin;
    private issueTokens;
    refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    logout(userId: string): Promise<{
        success: boolean;
    }>;
    getUserInfo(userId: string): Promise<any>;
}
