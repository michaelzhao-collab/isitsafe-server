import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';
export declare function isPremium(user: Pick<User, 'subscriptionExpire'> | null): boolean;
export declare class MembershipService {
    private prisma;
    constructor(prisma: PrismaService);
    getActivePlans(): Promise<{
        name: string;
        productId: string;
        price: number;
        currency: string;
        period: string;
        isRecommended: boolean;
    }[]>;
    isPremiumByUserId(userId: string | null): Promise<boolean>;
}
