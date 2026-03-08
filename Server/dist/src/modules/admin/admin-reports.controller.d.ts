import { ReportService } from '../report/report.service';
import { ReportStatus } from '@prisma/client';
export declare class AdminReportsController {
    private report;
    constructor(report: ReportService);
    list(page?: string, pageSize?: string, status?: ReportStatus): Promise<{
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
    updateStatus(id: string, body: {
        status: ReportStatus;
    }, adminId: string): Promise<{
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
    stats(): Promise<{
        pending: number;
        handled: number;
        rejected: number;
        total: number;
    }>;
}
