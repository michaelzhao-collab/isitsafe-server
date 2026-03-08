"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashForCache = hashForCache;
const crypto_1 = require("crypto");
function hashForCache(parts) {
    const str = Object.keys(parts)
        .sort()
        .map((k) => `${k}=${parts[k] ?? ''}`)
        .join('|');
    return (0, crypto_1.createHash)('sha256').update(str).digest('hex').slice(0, 32);
}
//# sourceMappingURL=hash.js.map