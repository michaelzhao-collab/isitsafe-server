import { ConfigService } from '@nestjs/config';
export declare const UPLOAD_TYPES: readonly ["avatar", "report", "screenshot", "case", "knowledge"];
export type UploadType = (typeof UPLOAD_TYPES)[number];
export declare class UploadService {
    private config;
    private client;
    private cdnDomain;
    constructor(config: ConfigService);
    uploadFile(buffer: Buffer, type: string, userId: string, mimeType: string, fileSize?: number): Promise<string>;
    uploadAvatar(userId: string, buffer: Buffer, mimeType: string): Promise<string>;
}
