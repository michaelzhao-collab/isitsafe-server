import { PrismaService } from '../../prisma/prisma.service';
export declare class QueriesController {
    private prisma;
    constructor(prisma: PrismaService);
    list(userId: string | undefined, page?: string, pageSize?: string, riskLevel?: string): Promise<{
        items: {
            id: string;
            content: string;
            riskLevel: string | null;
            createdAt: Date;
            confidence: number | null;
            inputType: string;
            imageUrl: string | null;
            resultJson: import("@prisma/client/runtime/library").JsonValue | null;
            aiProvider: string | null;
            deletedAt: Date | null;
            userId: string | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    delete(userId: string, id: string): Promise<{}>;
}
