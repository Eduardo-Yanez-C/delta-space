export const CLEANUP_MODULE_KEYS = [
  "QUOTES",
  "FV_STUDIES",
  "CLIENTS",
  "TEMPLATES",
  "PRODUCTS",
  "SUPPLIERS",
  /** Último en el orden: requiere vaciar el resto y doble confirmación en execute. */
  "USERS",
] as const;

export type CleanupModuleKey = (typeof CLEANUP_MODULE_KEYS)[number];

/** Orden global respetando FKs del schema Prisma. */
export const CLEANUP_MODULE_ORDER: CleanupModuleKey[] = [
  "QUOTES",
  "FV_STUDIES",
  "CLIENTS",
  "TEMPLATES",
  "PRODUCTS",
  "SUPPLIERS",
  "USERS",
];

export function isAdminDataCleanupEnabled(): boolean {
  return String(process.env.ENABLE_ADMIN_DATA_CLEANUP ?? "").toLowerCase() === "true";
}

/**
 * Reservado para entornos controlados (p. ej. reset de laboratorio). Si en el futuro se reexpone borrado físico de
 * `User`, debe exigirse este flag en el servidor además de confirmaciones explícitas en API.
 */
export function isAdminUserHardDeleteEnabled(): boolean {
  return String(process.env.ALLOW_ADMIN_USER_HARD_DELETE ?? "").toLowerCase() === "true";
}
