import { PrismaService } from '../../prisma/prisma.service';
export declare class MembershipCronService {
    private prisma;
    constructor(prisma: PrismaService);
    expireSubscriptionStatus(): Promise<void>;
}
