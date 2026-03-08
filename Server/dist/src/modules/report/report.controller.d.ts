import { ReportService } from './report.service';
export declare class ReportController {
    private report;
    constructor(report: ReportService);
    create(type: string, content: string, relatedQueryId?: string, userId?: string): Promise<{
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
}
