"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeContent = normalizeContent;
exports.detectType = detectType;
function normalizeContent(raw) {
    if (!raw || typeof raw !== 'string')
        return '';
    let s = raw.trim().toLowerCase();
    s = s.replace(/^https?:\/\//i, '');
    s = s.replace(/^www\./i, '');
    return s.trim();
}
const COMPANY_KEYWORDS = [
    '公司', '平台', '投资', '理财', '基金', '证券', '贷款', '网贷',
    '交易所', 'app', '软件', '官网', '客服', '机构', '集团', '控股',
];
function detectType(content, isScreenshot = false) {
    if (isScreenshot)
        return 'screenshot';
    const normalized = normalizeContent(content);
    const original = content.trim();
    if (/^https?:\/\//i.test(original) || /^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(normalized)) {
        return 'url';
    }
    if (/^[\d\s\-+]{7,15}$/.test(original.replace(/\s/g, '')) || /^1[3-9]\d{9}$/.test(original.replace(/\D/g, ''))) {
        return 'phone';
    }
    const lower = original.toLowerCase();
    if (COMPANY_KEYWORDS.some((k) => lower.includes(k))) {
        return 'company';
    }
    return 'text';
}
//# sourceMappingURL=normalize.js.map