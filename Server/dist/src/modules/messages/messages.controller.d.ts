import { PrismaService } from '../../prisma/prisma.service';
export declare class MessagesController {
    private prisma;
    constructor(prisma: PrismaService);
    list(userId: string, page?: string, pageSize?: string): Promise<{
        items: {
            id: string;
            title: string;
            content: string;
            link: string | null;
            createdAt: string;
            read: boolean;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    unreadCount(userId: string): Promise<{
        count: number;
    }>;
    markRead(userId: string, id: string): Promise<{
        ok: boolean;
    }>;
}
