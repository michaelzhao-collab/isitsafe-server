import { PrismaService } from '../../prisma/prisma.service';
export declare class AdminQueriesController {
    private prisma;
    constructor(prisma: PrismaService);
    list(page?: string, pageSize?: string, riskLevel?: string, startDate?: string, endDate?: string, includeDeleted?: string): Promise<{
        items: ({
            user: {
                id: string;
                phone: string | null;
                email: string | null;
            } | null;
        } & {
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
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    get(id: string): Promise<{
        user: {
            id: string;
            phone: string | null;
            email: string | null;
        } | null;
    } & {
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
    }>;
}
