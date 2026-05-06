"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLEANUP_MODULE_ORDER = exports.CLEANUP_MODULE_KEYS = void 0;
exports.isAdminDataCleanupEnabled = isAdminDataCleanupEnabled;
exports.isAdminUserHardDeleteEnabled = isAdminUserHardDeleteEnabled;
exports.CLEANUP_MODULE_KEYS = [
    "QUOTES",
    "FV_STUDIES",
    "CLIENTS",
    "TEMPLATES",
    "PRODUCTS",
    "SUPPLIERS",
    /** Último en el orden: requiere vaciar el resto y doble confirmación en execute. */
    "USERS",
];
/** Orden global respetando FKs del schema Prisma. */
exports.CLEANUP_MODULE_ORDER = [
    "QUOTES",
    "FV_STUDIES",
    "CLIENTS",
    "TEMPLATES",
    "PRODUCTS",
    "SUPPLIERS",
    "USERS",
];
function isAdminDataCleanupEnabled() {
    return String(process.env.ENABLE_ADMIN_DATA_CLEANUP ?? "").toLowerCase() === "true";
}
/**
 * Reservado para entornos controlados (p. ej. reset de laboratorio). Si en el futuro se reexpone borrado físico de
 * `User`, debe exigirse este flag en el servidor además de confirmaciones explícitas en API.
 */
function isAdminUserHardDeleteEnabled() {
    return String(process.env.ALLOW_ADMIN_USER_HARD_DELETE ?? "").toLowerCase() === "true";
}
