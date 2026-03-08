import { PrismaService } from '../../prisma/prisma.service';
export declare class KnowledgeService {
    private prisma;
    constructor(prisma: PrismaService);
    list(category?: string, page?: number, pageSize?: number, search?: string, language?: string): Promise<{
        items: {
            id: string;
            content: string;
            tags: import("@prisma/client/runtime/library").JsonValue;
            source: string | null;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            category: string;
            language: string;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    getById(id: string): Promise<{
        id: string;
        content: string;
        tags: import("@prisma/client/runtime/library").JsonValue;
        source: string | null;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        category: string;
        language: string;
    }>;
    create(data: {
        title: string;
        content: string;
        category: string;
        tags?: string[];
        language?: string;
        source?: string;
    }): Promise<{
        id: string;
        content: string;
        tags: import("@prisma/client/runtime/library").JsonValue;
        source: string | null;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        category: string;
        language: string;
    }>;
    update(id: string, data: {
        title?: string;
        content?: string;
        category?: string;
        tags?: string[];
        source?: string;
    }): Promise<{
        id: string;
        content: string;
        tags: import("@prisma/client/runtime/library").JsonValue;
        source: string | null;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        category: string;
        language: string;
    }>;
    delete(id: string): Promise<{
        id: string;
        content: string;
        tags: import("@prisma/client/runtime/library").JsonValue;
        source: string | null;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        category: string;
        language: string;
    }>;
}
