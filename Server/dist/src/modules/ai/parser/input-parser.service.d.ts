import { InputType } from '../../../common/utils/normalize';
export interface ParsedInput {
    inputType: InputType;
    normalizedContent: string;
    originalContent: string;
}
export declare class InputParserService {
    normalizeContent(raw: string): string;
    detectType(content: string, isScreenshot?: boolean): InputType;
    parse(content: string, isScreenshot?: boolean): ParsedInput;
    ocrFromImage(_imageBase64: string): Promise<string>;
}
