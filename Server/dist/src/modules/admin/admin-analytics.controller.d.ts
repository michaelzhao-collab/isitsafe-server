import { PrismaService } from '../../prisma/prisma.service';
export declare class AdminAnalyticsController {
    private prisma;
    constructor(prisma: PrismaService);
    stats(startDate?: string, endDate?: string): Promise<{
        totalQueries: number;
        highRiskCount: number;
        aiLogsTotal: number;
        byProvider: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.AiLogGroupByOutputType, "provider"[]> & {
            _count: number;
        })[];
    }>;
    logs(page?: string, pageSize?: string, startDate?: string, endDate?: string): Promise<{
        items: {
            id: string;
            createdAt: Date;
            provider: string;
            model: string | null;
            tokens: number | null;
            latencyMs: number | null;
            promptHash: string | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
}
