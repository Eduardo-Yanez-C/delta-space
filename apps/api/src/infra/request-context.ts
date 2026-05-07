import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthUserPayload } from "../modules/auth/auth.service";
import { isAdminDev, hasGlobalAdminPrivileges } from "../modules/auth/role-constants";

export type RequestContext = {
  user: AuthUserPayload;
  companyId: string;
  /** Admin bypass para RLS */
  isAdmin: boolean;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext(ctx: RequestContext, fn: () => any) {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | null {
  return storage.getStore() ?? null;
}

export function buildRequestContextFromUser(user: AuthUserPayload | null | undefined): RequestContext | null {
  if (!user) return null;
  const companyId = String((user as any).companyId ?? "").trim();
  if (!companyId) return null;
  const roles = Array.isArray((user as any).roles) ? (user as any).roles : [];
  const isAdmin = hasGlobalAdminPrivileges(roles) || isAdminDev(roles);
  return { user, companyId, isAdmin };
}

