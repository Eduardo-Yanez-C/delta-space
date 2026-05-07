"use client";

import { useMemo } from "react";
import { useAuth } from "./auth-context";

/**
 * Matriz de permisos por (action, resource).
 * La UI consulta permisos de forma semántica; internamente se resuelve por roles.
 */
/** Roles comerciales/técnicos operativos (incluye legacy VENTAS hasta renovar token). */
const COMMERCIAL_TECH = ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "VENTAS"];
/** Catálogo productos/proveedores/precios: vendedores técnicos e ingeniería. */
const CATALOG_OPERATIONS = [
  "ADMIN_DEV",
  "ADMIN",
  "VENDEDOR_TECNICO",
  "VENTAS",
  "INGENIERIA",
];
const ADMIN_ONLY = ["ADMIN_DEV", "ADMIN"];

const PERMISSIONS: Record<string, Record<string, string[]>> = {
  client: {
    create: COMMERCIAL_TECH,
    edit: COMMERCIAL_TECH,
    delete: ADMIN_ONLY,
  },
  product: {
    create: CATALOG_OPERATIONS,
    edit: CATALOG_OPERATIONS,
    delete: CATALOG_OPERATIONS,
    manage_suppliers: CATALOG_OPERATIONS,
    add_price: CATALOG_OPERATIONS,
  },
  supplier: {
    create: CATALOG_OPERATIONS,
    edit: CATALOG_OPERATIONS,
    deactivate: CATALOG_OPERATIONS,
    delete: CATALOG_OPERATIONS,
  },
  price: {
    add: CATALOG_OPERATIONS,
  },
  users: {
    access: ADMIN_ONLY,
    create: ADMIN_ONLY,
    edit: ADMIN_ONLY,
    activate: ADMIN_ONLY,
    /** Desactivar usuarios: solo ADMIN_DEV (alineado con API). */
    deactivate: ["ADMIN_DEV"],
  },
  /** Licencias / instalaciones: solo administración global. */
  installations: {
    access: ADMIN_ONLY,
  },
  /** Licencia JWT on-premise (servidor): mismo alcance que instalaciones admin. */
  onPremiseLicense: {
    access: ADMIN_ONLY,
  },
  /** Datos corporativos maestros (logo, razón social, banco, etc.): solo ADMIN_DEV / ADMIN. */
  companyProfile: {
    access: ADMIN_ONLY,
  },
  /** Cambio manual de nodo de datos (API) en LAN: solo administración / desarrollo. */
  lanNodes: {
    manage: ADMIN_ONLY,
  },
  /** Limpieza masiva de datos (requiere además ENABLE_ADMIN_DATA_CLEANUP en el servidor). */
  dataCleanup: {
    access: ADMIN_ONLY,
  },
  /** Panel administrador comercial (KPIs por vendedor, sin auditoría V2). */
  commercialPerformance: {
    access: ADMIN_ONLY,
  },
  /** Empresas (multi-empresa): solo administración global. */
  companies: {
    access: ADMIN_ONLY,
  },
  /** Auditoría (solo admin): ver acciones y cambios críticos. */
  auditLog: {
    access: ADMIN_ONLY,
  },
  companiesUsage: {
    access: ADMIN_ONLY,
  },
  quote: {
    read: ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "VENTAS", "INGENIERIA", "LECTURA"],
    create: COMMERCIAL_TECH,
    /** Edición general: cabecera, versiones, ítems (crear/editar/eliminar). */
    edit: COMMERCIAL_TECH,
    /** Override de precio en ítems: aplicar unitPriceOverride. */
    priceOverride: COMMERCIAL_TECH,
  },
  /** Estudios FV. Backend controla ownership; la UI solo muestra/oculta acciones según rol. */
  fvStudy: {
    read: ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "VENTAS", "INGENIERIA", "LECTURA"],
    create: ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "VENTAS", "INGENIERIA"],
    edit: ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "VENTAS", "INGENIERIA"],
    archive: ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "VENTAS", "INGENIERIA"],
    delete: ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "VENTAS", "INGENIERIA"],
  },
};

function hasPermission(
  roles: string[] | undefined,
  resource: string,
  action: string
): boolean {
  if (!roles?.length) return false;
  const resourcePerms = PERMISSIONS[resource];
  if (!resourcePerms) return false;
  const allowedRoles = resourcePerms[action];
  if (!allowedRoles) return false;
  return allowedRoles.some((r) => roles.includes(r));
}

/**
 * Consulta si el usuario actual puede realizar la acción sobre el recurso.
 * Uso: useCan('create', 'client'), useCan('access', 'users'), etc.
 */
export function useCan(action: string, resource: string): boolean {
  const { user } = useAuth();
  return useMemo(
    () => hasPermission(user?.roles, resource, action),
    [user?.roles, action, resource]
  );
}
