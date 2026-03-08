import { PrismaService } from '../../prisma/prisma.service';
export declare class UserController {
    private prisma;
    constructor(prisma: PrismaService);
    updateProfile(userId: string, body: {
        avatar?: string;
        nickname?: string;
        gender?: string;
        birthday?: string;
    }): Promise<{
        success: boolean;
    }>;
}
