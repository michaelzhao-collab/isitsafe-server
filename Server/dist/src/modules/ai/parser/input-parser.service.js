"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputParserService = void 0;
const common_1 = require("@nestjs/common");
const normalize_1 = require("../../../common/utils/normalize");
let InputParserService = class InputParserService {
    normalizeContent(raw) {
        return (0, normalize_1.normalizeContent)(raw);
    }
    detectType(content, isScreenshot = false) {
        return (0, normalize_1.detectType)(content, isScreenshot);
    }
    parse(content, isScreenshot = false) {
        const originalContent = content?.trim() || '';
        const inputType = this.detectType(originalContent, isScreenshot);
        const normalizedContent = this.normalizeContent(originalContent);
        return { inputType, normalizedContent, originalContent };
    }
    async ocrFromImage(_imageBase64) {
        return Promise.resolve('');
    }
};
exports.InputParserService = InputParserService;
exports.InputParserService = InputParserService = __decorate([
    (0, common_1.Injectable)()
], InputParserService);
//# sourceMappingURL=input-parser.service.js.map