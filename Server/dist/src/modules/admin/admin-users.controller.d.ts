import { PrismaService } from '../../prisma/prisma.service';
export declare class AdminUsersController {
    private prisma;
    constructor(prisma: PrismaService);
    list(page?: string, pageSize?: string, country?: string): Promise<{
        items: any[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    getOne(id: string): Promise<any>;
    updateStatus(id: string, status: string): Promise<{
        id: string;
        status: string;
        success: boolean;
    }>;
    updateUser(id: string, body: {
        avatar?: string;
        nickname?: string;
        gender?: string;
        birthday?: string;
    }): Promise<{
        success: boolean;
    }>;
}
