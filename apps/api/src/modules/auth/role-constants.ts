export const ROLE_ADMIN_DEV = "ADMIN_DEV";
export const ROLE_ADMIN = "ADMIN";
export const ROLE_VENDEDOR_TECNICO = "VENDEDOR_TECNICO";
export const ROLE_VENTAS_LEGACY = "VENTAS";
export const ROLE_INGENIERIA = "INGENIERIA";
export const ROLE_LECTURA = "LECTURA";

export const ELEVATED_USER_MANAGEMENT_ROLES = new Set([ROLE_ADMIN_DEV, ROLE_ADMIN]);

export function expandRolesForGuard(roles: string[]) {
  const s = new Set(roles);
  if (s.has(ROLE_ADMIN_DEV)) {
    s.add(ROLE_ADMIN);
    s.add(ROLE_VENTAS_LEGACY);
    s.add(ROLE_VENDEDOR_TECNICO);
    s.add(ROLE_INGENIERIA);
    s.add(ROLE_LECTURA);
  }
  if (s.has(ROLE_ADMIN)) {
    s.add(ROLE_VENTAS_LEGACY);
    s.add(ROLE_VENDEDOR_TECNICO);
    s.add(ROLE_INGENIERIA);
    s.add(ROLE_LECTURA);
  }
  if (s.has(ROLE_VENDEDOR_TECNICO)) {
    s.add(ROLE_VENTAS_LEGACY);
  }
  if (s.has(ROLE_VENTAS_LEGACY)) {
    s.add(ROLE_VENDEDOR_TECNICO);
  }
  return s;
}

export function isAdminDev(roles: string[]) {
  return roles.includes(ROLE_ADMIN_DEV);
}

export function canManageElevatedUsers(roles: string[]) {
  return isAdminDev(roles);
}

export function userRoleNamesHaveElevatedManagement(roleNames: string[]) {
  return roleNames.some((n) => ELEVATED_USER_MANAGEMENT_ROLES.has(n));
}

export function hasGlobalAdminPrivileges(roles: string[]) {
  return roles.includes(ROLE_ADMIN_DEV) || roles.includes(ROLE_ADMIN);
}

export function hasSalesLikePrivileges(roles: string[]) {
  return (
    hasGlobalAdminPrivileges(roles) ||
    roles.includes(ROLE_VENTAS_LEGACY) ||
    roles.includes(ROLE_VENDEDOR_TECNICO)
  );
}

export const OPERATIONAL_WRITE_ROLES = [
  ROLE_ADMIN_DEV,
  ROLE_ADMIN,
  ROLE_VENDEDOR_TECNICO,
  ROLE_INGENIERIA,
  ROLE_VENTAS_LEGACY,
];
