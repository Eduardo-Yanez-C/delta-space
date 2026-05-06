"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUOTE_STATUSES_HIDDEN_FROM_DEFAULT_LIST = exports.QUOTE_COMMERCIAL_STATUSES = void 0;
exports.normalizeQuoteCommercialStatus = normalizeQuoteCommercialStatus;
exports.isQuoteTerminalArchivedOrCancelled = isQuoteTerminalArchivedOrCancelled;
exports.QUOTE_COMMERCIAL_STATUSES = [
    "BORRADOR",
    "LISTA_PARA_ENVIAR",
    "ENVIADA",
    "ACEPTADA",
    "RECHAZADA",
    "ANULADA",
    "CERRADA_SIN_VENTA",
    "EXPIRADA",
    /** Gestionado: oculto en listados por defecto; conserva historial y versiones. */
    "ARCHIVADA",
];
/** Sinónimos de API → estado canónico. */
const QUOTE_STATUS_SYNONYMS = {
    CANCELADA: "ANULADA",
    CANCELADO: "ANULADA",
};
/** Cotizaciones que el listado GET /quotes excluye salvo `includeInactive=true`. */
exports.QUOTE_STATUSES_HIDDEN_FROM_DEFAULT_LIST = [
    "ARCHIVADA",
    "ANULADA",
];
function normalizeQuoteCommercialStatus(input) {
    const raw = (input || "").trim().toUpperCase();
    const normalized = QUOTE_STATUS_SYNONYMS[raw] ?? raw;
    if (exports.QUOTE_COMMERCIAL_STATUSES.includes(normalized)) {
        return normalized;
    }
    throw new Error(`Estado comercial inválido: ${input}`);
}
function isQuoteTerminalArchivedOrCancelled(status) {
    return exports.QUOTE_STATUSES_HIDDEN_FROM_DEFAULT_LIST.includes((status || "").trim().toUpperCase());
}
