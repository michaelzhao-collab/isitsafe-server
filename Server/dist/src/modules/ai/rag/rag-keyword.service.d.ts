import { PrismaService } from '../../../prisma/prisma.service';
export interface KnowledgeCaseHit {
    id: string;
    title: string;
    category: string;
    content: string;
    tags: string[];
    language: string;
    score: number;
}
export declare class RagKeywordService {
    private prisma;
    constructor(prisma: PrismaService);
    keywordExtract(content: string): string[];
    searchKnowledgeCases(keywords: string[], topK?: number, language?: string): Promise<KnowledgeCaseHit[]>;
}
