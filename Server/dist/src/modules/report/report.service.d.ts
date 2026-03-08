import { PrismaService } from '../../prisma/prisma.service';
import { ReportStatus } from '@prisma/client';
export declare class ReportService {
    private prisma;
    constructor(prisma: PrismaService);
    create(userId: string | null, type: string, content: string, relatedQueryId?: string): Promise<{
        id: string;
        type: string;
        content: string;
        createdAt: Date;
        userId: string | null;
        status: import(".prisma/client").$Enums.ReportStatus;
        handledBy: string | null;
        handledAt: Date | null;
        relatedQueryId: string | null;
    }>;
    list(page?: number, pageSize?: number, status?: ReportStatus): Promise<{
        items: ({
            user: {
                id: string;
                phone: string | null;
                email: string | null;
            } | null;
        } & {
            id: string;
            type: string;
            content: string;
            createdAt: Date;
            userId: string | null;
            status: import(".prisma/client").$Enums.ReportStatus;
            handledBy: string | null;
            handledAt: Date | null;
            relatedQueryId: string | null;
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    updateStatus(id: string, status: ReportStatus, handledBy: string): Promise<{
        id: string;
        type: string;
        content: string;
        createdAt: Date;
        userId: string | null;
        status: import(".prisma/client").$Enums.ReportStatus;
        handledBy: string | null;
        handledAt: Date | null;
        relatedQueryId: string | null;
    }>;
    getStats(): Promise<{
        pending: number;
        handled: number;
        rejected: number;
        total: number;
    }>;
}
