import { KnowledgeService } from './knowledge.service';
export declare class KnowledgeController {
    private knowledge;
    constructor(knowledge: KnowledgeService);
    list(category?: string, page?: string, pageSize?: string, search?: string, language?: string): Promise<{
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
}
