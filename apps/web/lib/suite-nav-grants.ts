import {
  buildSuiteNavHrefToGrantKeyMap,
  getAllSuiteNavGrantKeys,
  getSuiteGrantLabels,
  requireLogisticaRegistryGroup,
  requireVentasRegistryGroup,
} from "./suite-nav-registry";

/** Lista plana de claves (derivada del registro único `suite-nav-registry.ts`). */
const ALL_GRANT_KEYS_LIST = getAllSuiteNavGrantKeys();
export const SUITE_NAV_GRANT_KEYS = ALL_GRANT_KEYS_LIST as readonly string[];

export type SuiteNavGrantKey = (typeof SUITE_NAV_GRANT_KEYS)[number];

export const SUITE_GRANT_LABELS: Record<string, string> = getSuiteGrantLabels();

const ventasEntry = requireVentasRegistryGroup();
export const VENTAS_SUITE_GRANT_KEYS = ventasEntry.children.map((c) => c.grantKey) as readonly string[];

const ALLOWED = new Set(ALL_GRANT_KEYS_LIST);

const HREF_TO_GRANT = buildSuiteNavHrefToGrantKeyMap();

/** ADMIN / ADMIN_DEV ignoran la lista (acceso completo al menú suite). */
export function suiteNavMenuAdminBypass(roles: string[] | undefined): boolean {
  return !!roles?.some((r) => r === "ADMIN_DEV" || r === "ADMIN");
}

/**
 * null/undefined en grants = sin restricción guardada (menú completo salvo bypass admin).
 */
export function hasSuiteNavGrant(
  grants: string[] | null | undefined,
  roles: string[] | undefined,
  key: string,
): boolean {
  if (suiteNavMenuAdminBypass(roles)) return true;
  if (grants == null || grants === undefined) return true;
  return grants.includes(key);
}

/** Mostrar bloque Ventas si hay al menos un permiso ventas.* */
export function hasVentasNavSection(
  grants: string[] | null | undefined,
  roles: string[] | undefined,
): boolean {
  if (suiteNavMenuAdminBypass(roles)) return true;
  if (grants == null || grants === undefined) return true;
  return grants.some((g) => g.startsWith("ventas."));
}

/** Mostrar bloque Logística si hay permiso a la vista o a control de flota. */
export function hasLogisticaNavSection(
  grants: string[] | null | undefined,
  roles: string[] | undefined,
): boolean {
  if (suiteNavMenuAdminBypass(roles)) return true;
  if (grants == null || grants === undefined) return true;
  return grants.some((g) => g === "logistica" || g === "control_flota");
}

export function isFullSuiteNavGrantSet(grants: string[]): boolean {
  if (grants.length !== ALL_GRANT_KEYS_LIST.length) return false;
  const s = new Set(grants);
  return ALL_GRANT_KEYS_LIST.every((k) => s.has(k));
}

export function normalizeGrantsForSubmit(grants: string[]): string[] | null {
  const cleaned = [...new Set(grants.filter((x) => typeof x === "string" && ALLOWED.has(x)))];
  if (cleaned.length === 0) return [];
  if (isFullSuiteNavGrantSet(cleaned)) return null;
  return cleaned.sort();
}

/** Mapea ítems principales del menú suite (href del ítem «simple», no hubs de grupos con submenú). */
export function suiteNavItemHrefToGrantKey(href: string): string | null {
  if (href === requireVentasRegistryGroup().hubHref) return null;
  if (href === requireLogisticaRegistryGroup().hubHref) return null;
  return HREF_TO_GRANT[href] ?? null;
}

export function ventasChildHrefToGrantKey(href: string): string | null {
  return HREF_TO_GRANT[href] ?? null;
}

/** Primer destino del enlace principal «Ventas» según permisos (orden del registro). */
export function defaultVentasPanelHref(
  grants: string[] | null | undefined,
  roles: string[] | undefined,
): string {
  const v = requireVentasRegistryGroup();
  for (const c of v.children) {
    if (hasSuiteNavGrant(grants, roles, c.grantKey)) return c.href;
  }
  return v.panelHref;
}

/** Primer destino del enlace principal «Logística» según permisos (orden del registro). */
export function defaultLogisticaHref(
  grants: string[] | null | undefined,
  roles: string[] | undefined,
): string {
  const g = requireLogisticaRegistryGroup();
  for (const c of g.children) {
    if (hasSuiteNavGrant(grants, roles, c.grantKey)) return c.href;
  }
  return g.defaultHref;
}
