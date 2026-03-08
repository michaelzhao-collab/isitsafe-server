"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = exports.UPLOAD_TYPES = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ali_oss_1 = require("ali-oss");
exports.UPLOAD_TYPES = ['avatar', 'report', 'screenshot', 'case', 'knowledge'];
const FOLDER_MAP = {
    avatar: 'avatar',
    report: 'reports',
    screenshot: 'screenshots',
    case: 'cases',
    knowledge: 'knowledge',
};
const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
let UploadService = class UploadService {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.cdnDomain = this.config.get('CDN_DOMAIN', 'https://cdn.isitsafe.com').replace(/\/$/, '');
        const region = this.config.get('OSS_REGION');
        const bucket = this.config.get('OSS_BUCKET');
        const accessKeyId = this.config.get('OSS_ACCESS_KEY_ID');
        const accessKeySecret = this.config.get('OSS_ACCESS_KEY_SECRET');
        if (region && bucket && accessKeyId && accessKeySecret) {
            this.client = new ali_oss_1.default({
                region,
                bucket,
                accessKeyId,
                accessKeySecret,
            });
        }
    }
    async uploadFile(buffer, type, userId, mimeType, fileSize) {
        if (!this.client) {
            throw new common_1.BadRequestException('OSS not configured: set OSS_REGION, OSS_BUCKET, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET');
        }
        const t = type?.toLowerCase();
        if (!exports.UPLOAD_TYPES.includes(t)) {
            throw new common_1.BadRequestException(`type must be one of: ${exports.UPLOAD_TYPES.join(', ')}`);
        }
        if (!ALLOWED_MIMES.includes(mimeType)) {
            throw new common_1.BadRequestException('Allowed types: image/jpeg, image/png, image/webp');
        }
        if (fileSize != null && fileSize > MAX_FILE_SIZE) {
            throw new common_1.BadRequestException(`File size must be <= ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        }
        const folder = FOLDER_MAP[t];
        const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? 'jpg' : 'png';
        const objectKey = `${folder}/${userId}-${Date.now()}.${ext}`;
        await this.client.put(objectKey, buffer, {
            headers: { 'Content-Type': mimeType },
        });
        return `${this.cdnDomain}/${objectKey}`;
    }
    async uploadAvatar(userId, buffer, mimeType) {
        return this.uploadFile(buffer, 'avatar', userId, mimeType);
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadService);
//# sourceMappingURL=upload.service.js.map