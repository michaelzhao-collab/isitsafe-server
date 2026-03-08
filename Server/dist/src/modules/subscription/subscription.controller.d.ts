import { SubscriptionService } from './subscription.service';
export declare class SubscriptionController {
    private sub;
    constructor(sub: SubscriptionService);
    verify(userId: string, productId: string, receipt: string, paymentMethod?: 'Apple' | 'Google', transactionId?: string): Promise<{
        success: boolean;
        subscription: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            productId: string;
            planType: string;
            status: string;
            expireTime: Date;
            transactionId: string | null;
            historyLog: import("@prisma/client/runtime/library").JsonValue | null;
            paymentMethod: string;
        };
    }>;
    status(userId: string): Promise<{
        active: boolean;
        expireTime: null;
        productId: null;
        status: null;
        isPremium: boolean;
        planType: null;
    } | {
        active: boolean;
        expireTime: Date;
        productId: string;
        status: string;
        isPremium: boolean;
        planType: string;
    }>;
    refresh(userId: string): Promise<{
        active: boolean;
        expireTime: null;
        productId: null;
        status: null;
        isPremium: boolean;
        planType: null;
    } | {
        active: boolean;
        expireTime: Date;
        productId: string;
        status: string;
        isPremium: boolean;
        planType: string;
    } | {
        active: boolean;
        expireTime: null;
        productId: null;
        status: null;
    }>;
}
