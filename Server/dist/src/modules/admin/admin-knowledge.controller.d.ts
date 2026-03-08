import { KnowledgeService } from '../knowledge/knowledge.service';
export declare class AdminKnowledgeController {
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
    upload(body: {
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
    update(id: string, body: {
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
