export declare function normalizeContent(raw: string): string;
export type InputType = 'text' | 'phone' | 'url' | 'company' | 'screenshot';
export declare function detectType(content: string, isScreenshot?: boolean): InputType;
