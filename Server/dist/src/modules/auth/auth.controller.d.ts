import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/login.dto';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    login(body: {
        phone?: string;
        email?: string;
        code?: string;
        smsCode?: string;
    }, req: any): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
    logout(userId: string): Promise<{
        success: boolean;
    }>;
    userinfo(userId: string): Promise<any>;
    refresh(dto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
}
