import { UploadService } from './upload.service';
export declare class UploadController {
    private upload;
    constructor(upload: UploadService);
    file(userId: string, file: Express.Multer.File, type: string): Promise<{
        url: string;
    }>;
    avatar(userId: string, file: Express.Multer.File): Promise<{
        url: string;
    }>;
}
