import { AiService } from './ai.service';
import { AnalyzeTextDto, AnalyzeScreenshotDto } from './dto/analyze.dto';
export declare class AiController {
    private ai;
    constructor(ai: AiService);
    analyze(dto: AnalyzeTextDto, userId?: string): Promise<import("./ai.service").AnalyzeResult>;
    analyzeScreenshot(dto: AnalyzeScreenshotDto, userId?: string): Promise<import("./ai.service").AnalyzeResult>;
}
