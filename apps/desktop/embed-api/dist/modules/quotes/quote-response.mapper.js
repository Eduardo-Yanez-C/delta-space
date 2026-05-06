"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeTechnicalBasicsJson = serializeTechnicalBasicsJson;
exports.parseTechnicalBasicsJson = parseTechnicalBasicsJson;
exports.mapQuoteResponse = mapQuoteResponse;
const common_1 = require("@nestjs/common");
const TECHNICAL_BASICS_MAX_CHARS = 32000;
function serializeTechnicalBasicsJson(value) {
    const s = JSON.stringify(value);
    if (s.length > TECHNICAL_BASICS_MAX_CHARS) {
        throw new common_1.BadRequestException("technicalBasicsJson excede el tamaño máximo permitido");
    }
    return s;
}
function parseTechnicalBasicsJson(stored) {
    if (stored == null || stored.trim() === "")
        return null;
    try {
        const parsed = JSON.parse(stored);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
function mapQuoteResponse(q) {
    const { technicalBasicsJson: raw, ...rest } = q;
    return {
        ...rest,
        technicalBasicsJson: parseTechnicalBasicsJson(raw),
    };
}
