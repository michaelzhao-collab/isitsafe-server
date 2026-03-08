import { SubscriptionService } from '../subscription/subscription.service';
export declare class AdminSubscriptionController {
    private sub;
    constructor(sub: SubscriptionService);
    logs(): Promise<({
        user: {
            id: string;
            phone: string | null;
            email: string | null;
            country: string | null;
        };
    } & {
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
    })[]>;
}
