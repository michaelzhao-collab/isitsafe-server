import { PrismaService } from '../../../prisma/prisma.service';
export interface RiskDataHit {
    id: string;
    type: string;
    content: string;
    riskLevel: string;
    riskCategory: string | null;
    tags: unknown;
}
export declare class RiskDbService {
    private prisma;
    constructor(prisma: PrismaService);
    check(type: string, normalizedContent: string, originalContent: string): Promise<RiskDataHit | null>;
}
