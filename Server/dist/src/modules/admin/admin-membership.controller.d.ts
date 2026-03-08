import { PrismaService } from '../../prisma/prisma.service';
export declare class AdminMembershipController {
    private prisma;
    constructor(prisma: PrismaService);
    list(): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        productId: string;
        price: number;
        currency: string;
        period: string;
        description: string | null;
        isActive: boolean;
        sortOrder: number;
        isRecommended: boolean;
    }[]>;
    create(body: {
        name: string;
        productId: string;
        price: number;
        currency: string;
        period: string;
        description?: string;
        isActive?: boolean;
        sortOrder?: number;
        isRecommended?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        productId: string;
        price: number;
        currency: string;
        period: string;
        description: string | null;
        isActive: boolean;
        sortOrder: number;
        isRecommended: boolean;
    }>;
    update(id: string, body: {
        name?: string;
        productId?: string;
        price?: number;
        currency?: string;
        period?: string;
        description?: string;
        isActive?: boolean;
        sortOrder?: number;
        isRecommended?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        productId: string;
        price: number;
        currency: string;
        period: string;
        description: string | null;
        isActive: boolean;
        sortOrder: number;
        isRecommended: boolean;
    }>;
    delete(id: string): Promise<{
        success: boolean;
    }>;
}
