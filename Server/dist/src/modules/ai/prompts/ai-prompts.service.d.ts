import type { KnowledgeCaseHit } from '../rag/rag-keyword.service';
export declare class AiPromptsService {
    buildSystemPrompt(language: 'zh' | 'en'): string;
    buildUserPrompt(content: string, inputType: string, language: 'zh' | 'en', ragCases: KnowledgeCaseHit[], riskDbResult: string | null): string;
}
