import { PrismaService } from '../../prisma/prisma.service';
import type { RiskCheckResult } from './risk.types';
export declare class RiskService {
    private prisma;
    constructor(prisma: PrismaService);
    checkRisk(inputType: string, content: string): Promise<RiskCheckResult | null>;
}
