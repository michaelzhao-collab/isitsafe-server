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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const upload_service_1 = require("./upload.service");
const multer_1 = require("multer");
const MAX_SIZE_FILE = 10 * 1024 * 1024;
const MAX_SIZE_AVATAR = 5 * 1024 * 1024;
const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
function fileFilter(allowedTypes) {
    return (_req, file, cb) => {
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new common_1.BadRequestException('Allowed types: image/jpeg, image/png, image/webp'), false);
        }
        cb(null, true);
    };
}
let UploadController = class UploadController {
    constructor(upload) {
        this.upload = upload;
    }
    async file(userId, file, type) {
        if (!file?.buffer)
            throw new common_1.BadRequestException('Missing file');
        if (!type?.trim())
            throw new common_1.BadRequestException('Missing type');
        const url = await this.upload.uploadFile(file.buffer, type.trim(), userId, file.mimetype, file.size);
        return { url };
    }
    async avatar(userId, file) {
        if (!file?.buffer)
            throw new common_1.BadRequestException('Missing file');
        const url = await this.upload.uploadAvatar(userId, file.buffer, file.mimetype);
        return { url };
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)('file'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: MAX_SIZE_FILE },
        fileFilter: fileFilter(ALLOWED_MIMES),
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "file", null);
__decorate([
    (0, common_1.Post)('avatar'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: MAX_SIZE_AVATAR },
        fileFilter: fileFilter(['image/jpeg', 'image/jpg', 'image/png']),
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)('sub')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "avatar", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('upload'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [upload_service_1.UploadService])
], UploadController);
//# sourceMappingURL=upload.controller.js.map