/** Alineado con backend: roles que solo ADMIN_DEV puede gestionar en otros usuarios. */
export const ELEVATED_ROLE_NAMES = new Set(["ADMIN_DEV", "ADMIN"]);

export function userHasElevatedRole(roles: { name: string }[] | undefined): boolean {
  return roles?.some((r) => ELEVATED_ROLE_NAMES.has(r.name)) ?? false;
}

export function actorIsAdminDev(actorRoles: string[] | undefined): boolean {
  return !!actorRoles?.includes("ADMIN_DEV");
}

/** Puede usar la fila de edición / acciones sobre el usuario objetivo (UI; el backend valida igual). */
export function canManageUserRow(
  actorRoles: string[] | undefined,
  actorId: string | undefined,
  target: { id: string; roles?: { name: string }[] },
): boolean {
  if (!actorRoles?.length || !actorId) return false;
  if (actorIsAdminDev(actorRoles)) return true;
  if (!actorRoles.includes("ADMIN")) return false;
  if (target.id === actorId) return true;
  return !userHasElevatedRole(target.roles);
}
