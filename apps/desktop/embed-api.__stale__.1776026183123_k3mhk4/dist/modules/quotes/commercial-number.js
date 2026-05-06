"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMERCIAL_SEQUENCE_START = void 0;
exports.getCommercialSuffix = getCommercialSuffix;
exports.sellerInitialsForCommercialNumber = sellerInitialsForCommercialNumber;
exports.getNextCommercialNumber = getNextCommercialNumber;
exports.COMMERCIAL_SEQUENCE_START = 2780;
function getCommercialSuffix(projectType) {
    const t = (projectType || "").trim().toUpperCase();
    if (t === "RESIDENCIAL")
        return "RES";
    if (t === "COMERCIAL")
        return "COM";
    if (t === "INDUSTRIAL")
        return "IND";
    return "IND";
}
const NON_LETTER = /[^A-Za-z]/g;
function sellerInitialsForCommercialNumber(opts) {
    const pickTwo = (raw) => {
        const s = raw
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
        if (!s)
            return null;
        const parts = s.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            const a = (parts[0].replace(NON_LETTER, "")[0] || "").toUpperCase();
            const b = (parts[parts.length - 1].replace(NON_LETTER, "")[0] || "").toUpperCase();
            if (a && b)
                return a + b;
        }
        const lettersOnly = s.replace(NON_LETTER, "").toUpperCase();
        if (lettersOnly.length >= 2)
            return lettersOnly.slice(0, 2);
        if (lettersOnly.length === 1)
            return lettersOnly + lettersOnly;
        return null;
    };
    const fromFull = opts.fullName != null ? pickTwo(String(opts.fullName)) : null;
    if (fromFull)
        return fromFull;
    const fromName = opts.name != null ? pickTwo(String(opts.name)) : null;
    if (fromName)
        return fromName;
    const local = String(opts.email || "")
        .split("@")[0]
        .replace(NON_LETTER, "")
        .toUpperCase();
    if (local.length >= 2)
        return local.slice(0, 2);
    return "XX";
}
function sanitizeInitialsSuffix(raw) {
    const s = raw.replace(NON_LETTER, "").toUpperCase();
    if (s.length >= 2)
        return s.slice(0, 4);
    if (s.length === 1)
        return s + s;
    return "XX";
}
async function getNextCommercialNumber(prisma, projectType, opts) {
    const maxAgg = await prisma.quote.aggregate({
        _max: { commercialSequence: true },
    });
    const prev = maxAgg._max.commercialSequence;
    const nextSequence = (prev ?? exports.COMMERCIAL_SEQUENCE_START - 1) + 1;
    const suffix = getCommercialSuffix(projectType);
    const t = (projectType || "").trim().toUpperCase();
    const isIndustrial = t === "INDUSTRIAL" || suffix === "IND";
    const ini = sanitizeInitialsSuffix(opts?.sellerInitials ?? "");
    if (isIndustrial) {
        return {
            commercialSequence: nextSequence,
            commercialNumber: `IND-${String(nextSequence).padStart(6, "0")}-${ini}`,
        };
    }
    return {
        commercialSequence: nextSequence,
        commercialNumber: `${nextSequence}-${suffix}-${ini}`,
    };
}
