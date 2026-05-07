// Base URL del API. En build time se usa env o fallback; en runtime (navegador) se usa la config local si existe.
import { getLocalConfig } from "./local-config";
import { getLanRouting, normalizeApiBase } from "./lan-routing";
import { nestHttpErrorMessage } from "./nest-http-error-message";

/** Debe coincidir con `PROD_PORT` en apps/desktop/main.js (Next dentro del .exe). */
const DESKTOP_PACKAGED_WEB_PORT = "31337";

function computeFallbackApiBase(): string {
  const raw =
    (typeof process.env.NEXT_PUBLIC_API_BASE_URL === "string" && process.env.NEXT_PUBLIC_API_BASE_URL.trim()) ||
    (typeof process.env.NEXT_PUBLIC_API_URL === "string" && process.env.NEXT_PUBLIC_API_URL.trim()) ||
    "";
  const envUrl = raw ? raw.replace(/\/$/, "") : null;
  if (envUrl && !envUrl.startsWith("/")) return envUrl;
  return "http://localhost:4000/api";
}

const FALLBACK_API_BASE = computeFallbackApiBase();

/** Shell del .exe (Next en :31337): el API va siempre al Nest embebido. */
export function isDesktopPackagedWebShell(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname, port } = window.location;
  return (
    port === DESKTOP_PACKAGED_WEB_PORT &&
    (hostname === "127.0.0.1" || hostname === "localhost")
  );
}

/** Indica si la base del API apunta explícitamente a este equipo (localhost / 127.0.0.1). */
export function isLikelyLocalApiBase(base: string): boolean {
  try {
    const u = new URL(base.includes("://") ? base : `http://${base}`);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Base URL del API.
 * Shell empaquetado (127.0.0.1:31337):
 * - Si admin eligió nodo LAN manual → `pv_quoting_lan_routing` (peer).
 * - Si no → Nest embebido :4000 (siempre datos de este equipo).
 *
 * Navegador:
 * - Si hay peer manual en `pv_quoting_lan_routing` → esa URL (excepto en `next dev` en localhost: ver abajo).
 * - Si no → config /setup (on-prem) → env fallback.
 * No hay elección automática de líder LAN ni caché compartida entre equipos.
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (isDesktopPackagedWebShell()) {
      const lanPackaged = getLanRouting();
      if (lanPackaged.mode === "lan_peer" && lanPackaged.peerBaseUrl) {
        return normalizeApiBase(lanPackaged.peerBaseUrl);
      }
      return "http://127.0.0.1:4000/api";
    }
    /**
     * En `next dev` en loopback: forzar API local. Ignora `pv_quoting_install_config` y `pv_quoting_lan_routing`
     * (restos de portable/LAN dejan de responder y rompen Inicio / indicadores / FV aunque Nest :4000 esté bien).
     */
    const isLocalNextDev =
      process.env.NODE_ENV === "development" &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]");
    if (isLocalNextDev) {
      return normalizeApiBase(FALLBACK_API_BASE);
    }
    const lanBrowser = getLanRouting();
    if (lanBrowser.mode === "lan_peer" && lanBrowser.peerBaseUrl) {
      return normalizeApiBase(lanBrowser.peerBaseUrl);
    }
    /**
     * En build de producción (`next start`/deploy) sí se respeta la config local para instalaciones on-premise.
     */
    const c = getLocalConfig();
    if (c?.apiBaseUrl) return normalizeApiBase(c.apiBaseUrl);
  }
  return normalizeApiBase(FALLBACK_API_BASE);
}

/**
 * Base del API para Socket.IO de conversaciones (presencia + mensajes en tiempo real).
 * No usa el nodo de datos manual (`getLanRouting` / peer): apunta al Nest de este equipo.
 *
 * Prioridad:
 * 1. `NEXT_PUBLIC_CONVERSATIONS_SOCKET_ORIGIN` — origen del Nest, ej. `http://192.168.1.10:4000` o URL completa con `/api`.
 * 2. Shell empaquetado (Next en :31337): `http://127.0.0.1:4000/api`.
 * 3. Web (cloud): usa `getApiBase()` (mismo backend que el resto de endpoints).
 * 4. Navegador en LAN (hostname ≠ localhost) sin `NEXT_PUBLIC_API_BASE_URL`: `http://<hostname>:4000/api`.
 * 5. Localhost / SSR: misma lógica que fallback de `getApiBase()` (`NEXT_PUBLIC_API_URL` o `http://localhost:4000/api`).
 */
export function getLocalConversationsApiBase(): string {
  const envBase = resolveConversationsApiBaseFromEnv();
  if (envBase) return envBase;

  if (typeof window === "undefined") {
    return normalizeApiBase(computeFallbackApiBase());
  }

  if (isDesktopPackagedWebShell()) {
    return "http://127.0.0.1:4000/api";
  }

  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return normalizeApiBase(computeFallbackApiBase());
  }

  // En web (cloud), conversaciones deben ir al mismo API base que el resto (no "localhost:4000").
  const apiBase = getApiBase();
  if (!isLikelyLocalApiBase(apiBase)) {
    return normalizeApiBase(apiBase);
  }

  // Fallback LAN on-premise: si la app se sirve desde un host en red y no se configuró API base.
  const host = hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
  return normalizeApiBase(`http://${host}:4000/api`);
}

function resolveConversationsApiBaseFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_CONVERSATIONS_SOCKET_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
    const pathNoTrail = u.pathname.replace(/\/+$/, "") || "";
    if (pathNoTrail === "/api") {
      return normalizeApiBase(u.toString());
    }
    return normalizeApiBase(`${u.origin}/api`);
  } catch {
    return null;
  }
}

/** Valida que el API responde como Nest esperado (`{ ok: true }`). */
/** Registra peerId libp2p + installationId en el mismo Nest local que chat/socket (`getLocalConversationsApiBase`). Silencioso si falla. */
export async function registerP2pIdentity(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!getAuthToken()) return;
  try {
    const nestBase = getLocalConversationsApiBase();
    const peerRes = await fetch(`${nestBase}/p2p/local-peer`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    const peerJson = (await peerRes.json().catch(() => null)) as {
      ok?: boolean;
      peer_id?: string;
    } | null;
    if (!peerJson?.ok || !peerJson.peer_id) return;
    const cfg = getLocalConfig();
    const installationId =
      (cfg?.installationId && cfg.installationId.trim()) ||
      `web-${typeof window !== "undefined" ? window.location.hostname : "dev"}`;
    await fetch(`${nestBase}/p2p/register-identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        peerId: peerJson.peer_id,
        installationId,
      }),
    });
  } catch {
    /* daemon apagado o sin P2P */
  }
}

export async function probeApiHealth(
  apiBaseUrl: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  const base = apiBaseUrl.trim().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/health`, {
      signal,
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (j?.ok === true) return { ok: true };
    return { ok: false, error: "El servidor no respondió { ok: true } en /health" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de red";
    return { ok: false, error: msg };
  }
}

// Token JWT para peticiones autenticadas. Persistido en localStorage por AuthContext (MVP temporal).
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}
export function getAuthToken(): string | null {
  return authToken;
}
function getAuthHeaders(): Record<string, string> {
  if (typeof window !== "undefined" && authToken) {
    return { Authorization: `Bearer ${authToken}` };
  }
  return {};
}

// ——— Auth ———
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  fullName: string | null;
  active: boolean;
  companyId: string;
  roles: string[];
  /** null = sin restricción explícita en menú suite (comportamiento anterior). */
  suiteNavGrants?: string[] | null;
  impersonatedBy?: { id: string; email: string } | null;
};

export type LoginResponse = { accessToken: string; user: AuthUser };

export async function impersonateUser(userId: string): Promise<LoginResponse> {
  const res = await fetch(`${getApiBase()}/auth/impersonate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo impersonar"));
  }
  return res.json();
}

/** Respuesta de POST /installations/activate (activación de instalación/equipo). */
export type ActivateInstallationResponse = {
  installationId: string;
  installationToken: string;
  deviceName: string | null;
  createdAt: string;
};

/**
 * Activa una instalación con el código. Usar en /setup con la URL del API (baseUrl) antes de guardar config.
 */
export async function activateInstallation(
  baseUrl: string,
  data: { activationCode: string; deviceName?: string; appVersion?: string },
): Promise<ActivateInstallationResponse> {
  const url = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${url}/installations/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activationCode: data.activationCode.trim(),
      deviceName: data.deviceName?.trim() || undefined,
      appVersion: data.appVersion || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al activar instalación");
  }
  return res.json();
}

/** Respuesta de POST /installations/validate */
export type ValidateInstallationResponse = {
  valid: boolean;
  active: boolean;
  revoked: boolean;
  message?: string;
};

/** Valida la instalación registrada (al arranque). Usa la URL del API de la config local. */
export async function validateInstallation(
  data: { installationId: string; installationToken: string },
): Promise<ValidateInstallationResponse> {
  const res = await fetch(`${getApiBase()}/installations/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installationId: data.installationId.trim(),
      installationToken: data.installationToken.trim(),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al validar instalación");
  }
  return res.json();
}

/** Item del listado GET /api/installations (solo ADMIN). No incluye token. */
export type InstallationListItem = {
  id: string;
  activationCode: string;
  deviceName: string | null;
  machineFingerprint: string | null;
  active: boolean;
  revokedAt: string | null;
  createdAt: string;
  appVersion: string | null;
  notes: string | null;
};

export async function fetchInstallations(): Promise<InstallationListItem[]> {
  const res = await fetch(`${getApiBase()}/installations`, { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 403) throw new Error("Sin permiso para ver instalaciones");
    throw new Error("Error al cargar instalaciones");
  }
  return res.json();
}

export async function revokeInstallation(
  id: string,
  note?: string,
): Promise<InstallationListItem> {
  const res = await fetch(`${getApiBase()}/installations/${id}/revoke`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(note != null ? { note } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al revocar");
  }
  return res.json();
}

// ——— Licencia on-premise (servidor; ADMIN / ADMIN_DEV) ———

export type OnPremiseLicenseUiState =
  | "OK"
  | "MISSING"
  | "INVALID"
  | "EXPIRED"
  | "INSTALLATION_MISMATCH"
  | "PUBLIC_KEY_NOT_CONFIGURED"
  | "DISABLED";

export type OnPremiseLicenseStatusDto = {
  installationId: string;
  state: OnPremiseLicenseUiState;
  expiresAt: string | null;
  empresa: string | null;
  modalidad: string | null;
  message: string;
};

export async function fetchOnPremiseLicenseStatus(): Promise<OnPremiseLicenseStatusDto> {
  const res = await fetch(`${getApiBase()}/admin/on-premise-license/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error("Sin permiso para ver el estado de licencia");
    throw new Error("Error al cargar estado de licencia");
  }
  return res.json();
}

export async function uploadOnPremiseLicenseToken(token: string): Promise<{ ok: true }> {
  const res = await fetch(`${getApiBase()}/admin/on-premise-license/upload`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ token: token.trim() }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      code?: string;
    };
    const msg = Array.isArray(err.message) ? err.message.join(", ") : err.message;
    if (res.status === 403) throw new Error("Sin permiso para subir la licencia");
    if (res.status === 400 && msg) throw new Error(msg);
    throw new Error(msg ?? "No se pudo guardar la licencia");
  }
  return res.json();
}

export type DataCleanupModuleKey =
  | "QUOTES"
  | "FV_STUDIES"
  | "CLIENTS"
  | "TEMPLATES"
  | "PRODUCTS"
  | "SUPPLIERS"
  | "USERS";

export type DataCleanupPreviewResponse = {
  selectedModules: DataCleanupModuleKey[];
  expandedModules: DataCleanupModuleKey[];
  dependencyNotes: string[];
  counts: Record<string, number>;
};

export type DataCleanupExecuteResponse = {
  selectedModules: DataCleanupModuleKey[];
  expandedModules: DataCleanupModuleKey[];
  dependencyNotes: string[];
  deleted: Record<string, number>;
};

export async function fetchDataCleanupStatus(): Promise<{ enabled: boolean }> {
  const res = await fetch(`${getApiBase()}/admin/data-cleanup/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 403) throw new Error("Sin permiso");
    throw new Error("No se pudo consultar el estado de limpieza de datos");
  }
  return res.json();
}

export async function postDataCleanupPreview(body: {
  all?: boolean;
  modules?: DataCleanupModuleKey[];
}): Promise<DataCleanupPreviewResponse> {
  const res = await fetch(`${getApiBase()}/admin/data-cleanup/preview`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al analizar la limpieza"));
  }
  return res.json();
}

export async function postDataCleanupExecute(body: {
  all?: boolean;
  modules?: DataCleanupModuleKey[];
  password: string;
  confirmPhrase: string;
  /** Obligatorio si el plan incluye USERS: texto exacto `DESACTIVAR_USUARIOS` (solo desactiva cuentas). */
  confirmUsersPhrase?: string;
}): Promise<DataCleanupExecuteResponse> {
  const res = await fetch(`${getApiBase()}/admin/data-cleanup/execute`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo ejecutar la limpieza"));
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const base = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const looksLikeNetwork =
      e instanceof TypeError || /failed to fetch|networkerror|load failed|aborted|fetch/i.test(msg);
    if (looksLikeNetwork) {
      throw new Error(
        `No se pudo conectar con la API en ${base}. Arranque el backend (Nest) en el puerto correcto; en la raíz del monorepo: npm run dev:api o npm run dev (web + API). Si usa otro host o puerto, defina NEXT_PUBLIC_API_BASE_URL en apps/web/.env.local.`,
      );
    }
    throw e instanceof Error ? e : new Error(msg);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Credenciales inválidas");
  }
  return res.json();
}

export async function getMe(): Promise<AuthUser> {
  const res = await fetch(`${getApiBase()}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    throw new Error("Error al cargar sesión");
  }
  return res.json();
}

// ——— Companies (multi-empresa) ———
export type Company = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  companyId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityCompanyId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  metaJson: string | null;
  createdAt: string;
  user?: { id: string; email: string; name: string | null; fullName: string | null };
  company?: { id: string; name: string; slug: string };
};

export async function fetchCompanies(): Promise<Company[]> {
  const res = await fetch(`${getApiBase()}/companies`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al cargar empresas"));
  }
  return res.json();
}

export async function fetchCompany(id: string): Promise<Company> {
  const res = await fetch(`${getApiBase()}/companies/${encodeURIComponent(id)}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al cargar empresa"));
  }
  return res.json();
}

export async function createCompany(body: { name: string; slug: string; active?: boolean }): Promise<Company> {
  const res = await fetch(`${getApiBase()}/companies`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al crear empresa"));
  }
  return res.json();
}

export async function updateCompany(
  id: string,
  body: { name?: string; slug?: string; active?: boolean },
): Promise<Company> {
  const res = await fetch(`${getApiBase()}/companies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al actualizar empresa"));
  }
  return res.json();
}

export async function fetchAuditLogs(params?: {
  take?: number;
  companyId?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
}): Promise<AuditLog[]> {
  const qs = new URLSearchParams();
  if (params?.take) qs.set("take", String(params.take));
  if (params?.companyId) qs.set("companyId", params.companyId);
  if (params?.userId) qs.set("userId", params.userId);
  if (params?.entityType) qs.set("entityType", params.entityType);
  if (params?.entityId) qs.set("entityId", params.entityId);
  const q = qs.toString();
  const res = await fetch(`${getApiBase()}/admin/audit-logs${q ? `?${q}` : ""}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al cargar auditoría"));
  }
  return res.json();
}

export type UserInvitation = {
  id: string;
  companyId: string;
  email: string;
  tokenHash: string;
  roleIdsJson: string | null;
  nameHint: string | null;
  fullNameHint: string | null;
  active: boolean;
  expiresAt: string;
  acceptedAt: string | null;
  createdByUserId: string;
  acceptedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string; slug: string };
  createdBy?: { id: string; email: string; name: string | null; fullName: string | null };
  acceptedBy?: { id: string; email: string; name: string | null; fullName: string | null };
};

export async function fetchUserInvitations(): Promise<UserInvitation[]> {
  const res = await fetch(`${getApiBase()}/admin/user-invitations`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al cargar invitaciones"));
  }
  return res.json();
}

export async function createUserInvitation(body: {
  email: string;
  companyId: string;
  roleIds?: number[];
  expiresAt?: string | null;
  nameHint?: string | null;
  fullNameHint?: string | null;
}): Promise<{ invitation: UserInvitation; token: string }> {
  const res = await fetch(`${getApiBase()}/admin/user-invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al crear invitación"));
  }
  return res.json();
}

export async function acceptInvitation(body: {
  token: string;
  password: string;
  name?: string | null;
  fullName?: string | null;
}): Promise<{ ok: true }> {
  const res = await fetch(`${getApiBase()}/auth/accept-invitation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo aceptar la invitación"));
  }
  return res.json();
}

export type CompanyUsageRow = {
  companyId: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  users: number;
  quotesInRange: number;
  fvStudiesInRange: number;
  lastLoginAt: string | null;
};

export async function fetchCompaniesUsage(params?: { from?: string; to?: string }): Promise<{
  range: { from: string; to: string };
  companies: CompanyUsageRow[];
}> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const q = qs.toString();
  const res = await fetch(`${getApiBase()}/admin/companies/usage${q ? `?${q}` : ""}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al cargar uso por empresa"));
  }
  return res.json();
}

export type Client = {
  id: string;
  type: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientInput = {
  type: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type UpdateClientInput = Partial<CreateClientInput>;

export async function fetchClients(): Promise<Client[]> {
  const res = await fetch(`${getApiBase()}/clients`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar clientes");
  return res.json();
}

export async function fetchClient(id: string): Promise<Client> {
  const res = await fetch(`${getApiBase()}/clients/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Cliente no encontrado");
    throw new Error("Error al cargar cliente");
  }
  return res.json();
}

export async function createClient(data: CreateClientInput): Promise<Client> {
  const res = await fetch(`${getApiBase()}/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al crear cliente"));
  }
  return res.json();
}

export async function updateClient(
  id: string,
  data: UpdateClientInput
): Promise<Client> {
  const res = await fetch(`${getApiBase()}/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al actualizar cliente"));
  }
  return res.json();
}

export async function deleteClient(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/clients/${id}`, { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al eliminar cliente"));
  }
}

// ——— Catálogo ———
export type Category = { id: number; name: string; slug: string; parentId: number | null; children?: Category[] };
export type Brand = { id: number; name: string };
export type ProductModel = { id: number; name: string; brandId: number; brand?: Brand };

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${getApiBase()}/categories`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar categorías");
  return res.json();
}
export async function fetchBrands(): Promise<Brand[]> {
  const res = await fetch(`${getApiBase()}/brands`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar marcas");
  return res.json();
}
export async function fetchProductModels(brandId?: number, signal?: AbortSignal): Promise<ProductModel[]> {
  const url = brandId != null ? `${getApiBase()}/product-models?brandId=${brandId}` : `${getApiBase()}/product-models`;
  const res = await fetch(url, { headers: getAuthHeaders(), signal });
  if (!res.ok) throw new Error("Error al cargar modelos");
  return res.json();
}

// ——— Proveedores ———
export type Supplier = {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  giro?: string | null;
  commercialAddress?: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  defaultCurrency: string | null;
  supplyOrigin: string;
  actorType: string;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
export type CreateSupplierInput = {
  name: string;
  legalName?: string;
  taxId?: string;
  giro?: string;
  commercialAddress?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  defaultCurrency?: string;
  supplyOrigin: string;
  actorType: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  notes?: string;
  active?: boolean;
};
export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export async function fetchSuppliers(filters?: { supplyOrigin?: string; actorType?: string; active?: boolean }): Promise<Supplier[]> {
  const params = new URLSearchParams();
  if (filters?.supplyOrigin) params.set("supplyOrigin", filters.supplyOrigin);
  if (filters?.actorType) params.set("actorType", filters.actorType);
  if (filters?.active !== undefined) params.set("active", String(filters.active));
  const q = params.toString();
  const res = await fetch(`${getApiBase()}/suppliers${q ? `?${q}` : ""}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar proveedores");
  return res.json();
}
export async function fetchSupplier(id: string): Promise<Supplier> {
  const res = await fetch(`${getApiBase()}/suppliers/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) { if (res.status === 404) throw new Error("Proveedor no encontrado"); throw new Error("Error al cargar proveedor"); }
  return res.json();
}
export async function createSupplier(data: CreateSupplierInput): Promise<Supplier> {
  const res = await fetch(`${getApiBase()}/suppliers`, { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(data) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al crear proveedor"));
  }
  return res.json();
}
export async function updateSupplier(id: string, data: UpdateSupplierInput): Promise<Supplier> {
  const res = await fetch(`${getApiBase()}/suppliers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(data) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al actualizar proveedor"));
  }
  return res.json();
}
export async function deactivateSupplier(id: string): Promise<Supplier> {
  const res = await fetch(`${getApiBase()}/suppliers/${id}/deactivate`, { method: "PATCH", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al desactivar proveedor"));
  }
  return res.json();
}

export async function activateSupplier(id: string): Promise<Supplier> {
  const res = await fetch(`${getApiBase()}/suppliers/${id}/activate`, { method: "PATCH", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al activar proveedor"));
  }
  return res.json();
}

export async function deleteSupplier(id: string): Promise<{ deleted: boolean }> {
  const res = await fetch(`${getApiBase()}/suppliers/${id}`, { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al eliminar proveedor"));
  }
  return res.json();
}

// ——— Productos ———
export type ProductPanelSpecs = {
  id: string;
  productId: string;
  powerW: number | null;
  efficiencyPercent: number | null;
  vmpV: number | null;
  impA: number | null;
  vocV: number | null;
  iscA: number | null;
  bifacialityPercent: number | null;
  cellType: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  weightKg: number | null;
};
export type ProductInverterSpecs = {
  id: string;
  productId: string;
  inverterType: string | null;
  powerAcW: number | null;
  maxPvVoltageV: number | null;
  startupVoltageV: number | null;
  mpptVoltageMinV: number | null;
  mpptVoltageMaxV: number | null;
  maxDcCurrentA: number | null;
  efficiencyPercent: number | null;
  connectionType: string | null;
  ipRating: string | null;
  communication: string | null;
};
export type ProductBatterySpecs = {
  id: string;
  productId: string;
  capacityKwh: number | null;
  nominalVoltageV: number | null;
  maxChargeDischargePowerW: number | null;
  chemistry: string | null;
  cycles: number | null;
  weightKg: number | null;
  dimensionsMm: string | null;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  internalCode: string | null;
  sku: string | null;
  technicalSheetUrl: string | null;
  realManufacturer: string | null;
  commercialStatus: string;
  defaultCurrency: string | null;
  unit: string;
  purchaseUnit: string | null;
  warranty: string | null;
  leadTimeDays: number | null;
  stockReference: string | null;
  origin: string | null;
  internalNotes: string | null;
  categoryId: number;
  category?: Category;
  brandId: number | null;
  brand?: Brand | null;
  brandNameFree?: string | null;
  modelId: number | null;
  model?: ProductModel | null;
  modelNameFree?: string | null;
  primarySupplierId: string | null;
  primarySupplier?: Supplier | null;
  productSuppliers?: ProductSupplier[];
  prices?: ProductPrice[];
  panelSpecs?: ProductPanelSpecs | null;
  inverterSpecs?: ProductInverterSpecs | null;
  batterySpecs?: ProductBatterySpecs | null;
};

export type CreateProductPanelSpecsInput = {
  powerW?: number;
  efficiencyPercent?: number;
  vmpV?: number;
  impA?: number;
  vocV?: number;
  iscA?: number;
  bifacialityPercent?: number;
  cellType?: string;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  weightKg?: number;
};
export type CreateProductInverterSpecsInput = {
  inverterType?: string;
  powerAcW?: number;
  maxPvVoltageV?: number;
  startupVoltageV?: number;
  mpptVoltageMinV?: number;
  mpptVoltageMaxV?: number;
  maxDcCurrentA?: number;
  efficiencyPercent?: number;
  connectionType?: string;
  ipRating?: string;
  communication?: string;
};
export type CreateProductBatterySpecsInput = {
  capacityKwh?: number;
  nominalVoltageV?: number;
  maxChargeDischargePowerW?: number;
  chemistry?: string;
  cycles?: number;
  weightKg?: number;
  dimensionsMm?: string;
};

export type CreateProductInput = {
  internalCode?: string;
  sku?: string;
  categoryId: number;
  brandId?: number;
  brandNameFree?: string;
  modelId?: number;
  modelNameFree?: string;
  name: string;
  description?: string;
  unit: string;
  purchaseUnit?: string;
  technicalSheetUrl?: string;
  realManufacturer?: string;
  commercialStatus?: string;
  defaultCurrency?: string;
  warranty?: string;
  leadTimeDays?: number;
  stockReference?: string;
  origin?: string;
  internalNotes?: string;
  primarySupplierId?: string;
  panelSpecs?: CreateProductPanelSpecsInput;
  inverterSpecs?: CreateProductInverterSpecsInput;
  batterySpecs?: CreateProductBatterySpecsInput;
};
export type UpdateProductInput = Omit<Partial<CreateProductInput>, "panelSpecs" | "inverterSpecs" | "batterySpecs" | "primarySupplierId" | "brandNameFree" | "modelNameFree"> & {
  primarySupplierId?: string | null;
  brandNameFree?: string | null;
  modelNameFree?: string | null;
  panelSpecs?: CreateProductPanelSpecsInput | null;
  inverterSpecs?: CreateProductInverterSpecsInput | null;
  batterySpecs?: CreateProductBatterySpecsInput | null;
};

export type ProductFilters = {
  categoryId?: number;
  brandId?: number;
  modelId?: number;
  supplierId?: string;
  supplyOrigin?: string;
  commercialStatus?: string;
  search?: string;
};
export async function fetchProducts(filters?: ProductFilters): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filters?.categoryId != null) params.set("categoryId", String(filters.categoryId));
  if (filters?.brandId != null) params.set("brandId", String(filters.brandId));
  if (filters?.modelId != null) params.set("modelId", String(filters.modelId));
  if (filters?.supplierId) params.set("supplierId", filters.supplierId);
  if (filters?.supplyOrigin) params.set("supplyOrigin", filters.supplyOrigin);
  if (filters?.commercialStatus) params.set("commercialStatus", filters.commercialStatus);
  if (filters?.search) params.set("search", filters.search);
  const q = params.toString();
  const res = await fetch(`${getApiBase()}/products${q ? `?${q}` : ""}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar productos");
  return res.json();
}
export async function fetchProduct(id: string, includeLatestPrice?: boolean): Promise<Product> {
  const url = includeLatestPrice ? `${getApiBase()}/products/${id}?includeLatestPrice=true` : `${getApiBase()}/products/${id}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) { if (res.status === 404) throw new Error("Producto no encontrado"); throw new Error("Error al cargar producto"); }
  return res.json();
}
export async function createProduct(data: CreateProductInput): Promise<Product> {
  const res = await fetch(`${getApiBase()}/products`, { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(data) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al crear producto"));
  }
  return res.json();
}
export async function updateProduct(id: string, data: UpdateProductInput): Promise<Product> {
  const res = await fetch(`${getApiBase()}/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(data) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al actualizar producto"));
  }
  return res.json();
}

export async function deactivateProduct(id: string): Promise<Product> {
  const res = await fetch(`${getApiBase()}/products/${id}/deactivate`, { method: "PATCH", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al desactivar producto"));
  }
  return res.json();
}

export async function activateProduct(id: string): Promise<Product> {
  const res = await fetch(`${getApiBase()}/products/${id}/activate`, { method: "PATCH", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al reactivar producto"));
  }
  return res.json();
}

export async function deleteProduct(id: string): Promise<{ deleted: boolean }> {
  const res = await fetch(`${getApiBase()}/products/${id}`, { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al eliminar producto"));
  }
  return res.json();
}

// ——— Producto–Proveedor ———
export type ProductSupplier = {
  id: string;
  productId: string;
  supplierId: string;
  isPrimary: boolean;
  isAlternative: boolean;
  leadTimeDays: number | null;
  moq: string | null;
  warranty: string | null;
  notes: string | null;
  supplier?: Supplier;
};
export type CreateProductSupplierInput = {
  supplierId: string;
  isPrimary?: boolean;
  isAlternative?: boolean;
  leadTimeDays?: number;
  moq?: string;
  warranty?: string;
  notes?: string;
};
export type UpdateProductSupplierInput = {
  isPrimary?: boolean;
  isAlternative?: boolean;
  leadTimeDays?: number;
  moq?: string;
  warranty?: string;
  notes?: string;
};
export async function fetchProductSuppliers(productId: string): Promise<ProductSupplier[]> {
  const res = await fetch(`${getApiBase()}/products/${productId}/suppliers`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar proveedores del producto");
  return res.json();
}
export async function addProductSupplier(productId: string, data: CreateProductSupplierInput): Promise<ProductSupplier> {
  const res = await fetch(`${getApiBase()}/products/${productId}/suppliers`, { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(data) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al asociar proveedor"));
  }
  return res.json();
}
export async function updateProductSupplier(productId: string, supplierId: string, data: UpdateProductSupplierInput): Promise<ProductSupplier> {
  const res = await fetch(`${getApiBase()}/products/${productId}/suppliers/${supplierId}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(data) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al actualizar asociación"));
  }
  return res.json();
}
export async function removeProductSupplier(productId: string, supplierId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/products/${productId}/suppliers/${supplierId}`, { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      nestHttpErrorMessage(err, "No se puede eliminar la asociación (hay historial de precios)"),
    );
  }
}

// ——— Precios ———
export type ProductPrice = {
  id: string;
  productId: string;
  supplierId: string | null;
  supplier?: Supplier | null;
  price: number;
  cost: number | null;
  purchasePrice: number | null;
  currency: string;
  priceListType: string;
  validFrom: string;
  validTo: string | null;
  lastQuoteReceivedAt: string | null;
  lastUpdatedAt: string | null;
  suggestedMarginPercent: number | null;
  supplierDiscountPercent: number | null;
  logisticCostEstimate: number | null;
  customsCostEstimate: number | null;
  totalLandedCost: number | null;
  moq: string | null;
  warranty: string | null;
  quoteReference: string | null;
  quoteReceivedAt: string | null;
  validityIndicator: string | null;
  internalCommercialNotes: string | null;
};
export type CreatePriceInput = {
  productId: string;
  supplierId?: string;
  price: number;
  cost?: number;
  purchasePrice?: number;
  currency?: string;
  priceListType?: string;
  validFrom: string;
  validTo?: string;
  lastQuoteReceivedAt?: string;
  lastUpdatedAt?: string;
  suggestedMarginPercent?: number;
  supplierDiscountPercent?: number;
  logisticCostEstimate?: number;
  customsCostEstimate?: number;
  totalLandedCost?: number;
  moq?: string;
  warranty?: string;
  quoteReference?: string;
  quoteReceivedAt?: string;
  validityIndicator?: string;
  internalCommercialNotes?: string;
};
export async function fetchProductPrices(productId: string): Promise<ProductPrice[]> {
  const res = await fetch(`${getApiBase()}/products/${productId}/prices`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar precios");
  return res.json();
}
export async function createPrice(data: CreatePriceInput): Promise<ProductPrice> {
  const res = await fetch(`${getApiBase()}/prices`, { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(data) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al crear precio"));
  }
  return res.json();
}

// ——— Users & Roles ———
export type Role = { id: number; name: string; description: string | null };
export type User = {
  id: string;
  email: string;
  name: string | null;
  fullName: string | null;
  active: boolean;
  companyId: string;
  roles: Role[];
  suiteNavGrants?: string[] | null;
  /** null = sin límite mensual (UTC) para el asistente IA de suite. */
  suiteAgentMonthlyTokenLimit?: number | null;
  /** null = acceso sin fecha de fin de licencia (solo restricciones por rol/activo). */
  accessExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CreateUserInput = {
  email: string;
  password: string;
  name?: string;
  fullName?: string;
  roleIds: number[];
  companyId: string;
  active?: boolean;
  suiteNavGrants?: string[] | null;
  suiteAgentMonthlyTokenLimit?: number | null;
  /** ISO 8601 o null: fin de licencia de acceso. Omitir = sin caducidad. */
  accessExpiresAt?: string | null;
};
export type UpdateUserInput = {
  name?: string;
  fullName?: string;
  active?: boolean;
  roleIds?: number[];
  companyId?: string;
  suiteNavGrants?: string[] | null;
  suiteAgentMonthlyTokenLimit?: number | null;
  /** null = quitar caducidad; ISO = fin de licencia. */
  accessExpiresAt?: string | null;
};

export type SuiteAgentUsageMeResponse = {
  year: number;
  month: number;
  suiteAgentMonthlyTokenLimit: number | null;
  usedTotal: number;
  remaining: number | null;
  percentOfLimit: number | null;
  daily: { day: string; shortLabel: string; totalTokens: number }[];
};

export type SuiteAgentUsageAdminResponse = {
  year: number;
  month: number;
  filterUserId: string | null;
  byUser: {
    userId: string;
    email: string;
    name: string | null;
    suiteAgentMonthlyTokenLimit: number | null;
    usedTotal: number;
    callCount: number;
    percentOfLimit: number | null;
  }[];
  dailyTotals: { day: string; shortLabel: string; totalTokens: number }[];
};

export async function fetchSuiteAgentUsageMe(opts?: {
  year?: number;
  month?: number;
}): Promise<SuiteAgentUsageMeResponse> {
  const q = new URLSearchParams();
  if (opts?.year != null) q.set("year", String(opts.year));
  if (opts?.month != null) q.set("month", String(opts.month));
  const qs = q.toString();
  const res = await fetch(`${getApiBase()}/suite-agent/usage/me${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al cargar uso de IA"));
  }
  return res.json();
}

export async function fetchSuiteAgentUsageAdmin(opts: {
  year: number;
  month: number;
  userId?: string;
}): Promise<SuiteAgentUsageAdminResponse> {
  const q = new URLSearchParams();
  q.set("year", String(opts.year));
  q.set("month", String(opts.month));
  if (opts.userId) q.set("userId", opts.userId);
  const res = await fetch(`${getApiBase()}/suite-agent/usage/admin?${q.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al cargar uso global de IA"));
  }
  return res.json();
}

export async function fetchRoles(): Promise<Role[]> {
  const res = await fetch(`${getApiBase()}/roles`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar roles");
  return res.json();
}
export async function fetchUsers(activeOnly?: boolean): Promise<User[]> {
  const q = activeOnly === true ? "?activeOnly=true" : "";
  const res = await fetch(`${getApiBase()}/users${q}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar usuarios");
  return res.json();
}
export async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`${getApiBase()}/users/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Usuario no encontrado");
    throw new Error("Error al cargar usuario");
  }
  return res.json();
}
export async function createUser(data: CreateUserInput): Promise<User> {
  const res = await fetch(`${getApiBase()}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al crear usuario"));
  }
  return res.json();
}
export async function updateUser(id: string, data: UpdateUserInput): Promise<User> {
  const res = await fetch(`${getApiBase()}/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al actualizar usuario"));
  }
  return res.json();
}
export async function activateUser(id: string): Promise<User> {
  const res = await fetch(`${getApiBase()}/users/${id}/activate`, { method: "PATCH", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al activar usuario"));
  }
  return res.json();
}
export async function deactivateUser(id: string): Promise<User> {
  const res = await fetch(`${getApiBase()}/users/${id}/deactivate`, { method: "PATCH", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al desactivar usuario"));
  }
  return res.json();
}

export async function resetUserPassword(id: string, password: string): Promise<{ ok: true }> {
  const res = await fetch(`${getApiBase()}/users/${id}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al restablecer contraseña"));
  }
  return res.json();
}

// ——— Dashboard (D1) ———
export type DashboardKpis = {
  quotesTotal: number;
  quotesThisMonth: number;
  totalQuotedAmount: number;
  averageTicket: number;
  studiesTotal: number;
  studiesConverted: number;
  conversionPercent: number;
};
export type DashboardQuoteRow = {
  id: string;
  title: string;
  status: string;
  clientName: string;
  total: number;
  updatedAt: string;
};
export type DashboardStudyRow = {
  id: string;
  title: string;
  status: string;
  clientName: string;
  updatedAt: string;
};
export type DashboardChartQuotesByMonthItem = { month: string; label: string; count: number };
export type DashboardChartQuotesByOriginItem = { origin: string; label: string; count: number };
export type DashboardChartStudiesByStatusItem = { status: string; label: string; count: number };
export type DashboardCharts = {
  quotesByMonth: DashboardChartQuotesByMonthItem[];
  studiesByMonth: DashboardChartQuotesByMonthItem[];
  quotesByOrigin: DashboardChartQuotesByOriginItem[];
  studiesByStatus: DashboardChartStudiesByStatusItem[];
};

export type DashboardData = {
  kpis: DashboardKpis;
  latestQuotes: DashboardQuoteRow[];
  latestStudies: DashboardStudyRow[];
  studiesWithoutQuote: DashboardStudyRow[];
  charts: DashboardCharts;
};

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${getApiBase()}/dashboard`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar");
  const j = (await res.json()) as DashboardData;
  if (j.charts && !Array.isArray(j.charts.studiesByMonth)) {
    j.charts = { ...j.charts, studiesByMonth: [] };
  }
  return j;
}

// ——— Panel administrador comercial V1 ———
export type CommercialPerformanceAttribution = {
  summary: string;
  rules: string[];
};

export type CommercialPerformanceKpis = {
  quotesCreated: number;
  fvStudiesCreated: number;
  fvStudiesConverted: number;
  totalQuotedAmount: number;
  averageTicket: number;
  conversionPercent: number;
};

export type CommercialPerformanceSeller = {
  userId: string;
  email: string;
  name: string;
  active: boolean;
  quotesCreated: number;
  fvStudiesCreated: number;
  fvStudiesConverted: number;
  totalQuotedAmount: number;
  averageTicket: number;
  quotesByStatus: { status: string; count: number }[];
  lastActivityAt: string | null;
};

export type CommercialPerformanceCharts = {
  quotesByMonth: { month: string; label: string; count: number }[];
  amountsBySeller: { userId: string; name: string; amount: number }[];
  quotesByStatus: { status: string; count: number }[];
  conversion: { converted: number; notConverted: number };
};

export type CommercialPerformanceData = {
  attribution: CommercialPerformanceAttribution;
  v2Note: string;
  period: { from: string; to: string };
  kpis: CommercialPerformanceKpis;
  sellers: CommercialPerformanceSeller[];
  charts: CommercialPerformanceCharts;
};

export type CommercialPerformanceQuery = {
  from: string;
  to: string;
  userIds?: string[];
};

export async function fetchCommercialPerformance(q: CommercialPerformanceQuery): Promise<CommercialPerformanceData> {
  const params = new URLSearchParams();
  params.set("from", q.from);
  params.set("to", q.to);
  if (q.userIds?.length) {
    for (const id of q.userIds) params.append("userIds", id);
  }
  const res = await fetch(`${getApiBase()}/admin/commercial-performance?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al cargar el panel comercial"));
  }
  return res.json() as Promise<CommercialPerformanceData>;
}

// ——— Suite: proyectos (alineado a Software de Mejora — resumen / listado) ———
export type SuiteProjectRow = {
  id: string;
  code: string;
  name: string;
  client: string;
  status: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  progress: number;
  description: string | null;
  /** Fase 2 transporte: perfil de variables de mercado. */
  transportVariableProfileId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectLocation = {
  id?: string;
  projectId?: string;
  kind: string;
  label: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  isPrimary?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SuiteProjectMilestone = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  plannedDate: string;
  actualDate: string | null;
  status: string;
  criticality: string;
  createdAt: string;
  updatedAt: string;
};

export type SuiteProjectDecision = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  decisionDate: string;
  responsible: string | null;
  responsibleUserId: string | null;
  impact: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type SuiteProjectDetail = SuiteProjectRow & {
  /** Configuración de estados de tareas (objeto parseado desde API). */
  taskStatusConfig?: unknown;
  /** Estados de transporte terrestre (misma forma que taskStatusConfig). */
  logisticsTransportStatusConfig?: unknown;
  locations?: ProjectLocation[];
  commercialLinks: Array<{
    id: string;
    externalSystem: string;
    externalRef: string;
    metadata: string | null;
    createdAt: string;
  }>;
  milestones: SuiteProjectMilestone[];
  decisions: SuiteProjectDecision[];
  _count: { tasks: number; documents: number; risks: number; resources: number; commitments: number };
};

/** Fila de «Campos» en la ficha de tarea (persistido en Task.customFields). */
export type SuiteTaskCustomFieldRow = {
  id: string;
  type: string;
  label: string;
  value: string;
  required: boolean;
};

/** Tarea de cronograma (respuesta GET …/projects/:id/tasks). */
export type SuiteTaskRow = {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  weight: number;
  isCritical: boolean;
  wbsCode: string | null;
  sortOrder: number;
  isMilestone: boolean;
  duration: number | null;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  baselineDurationDays: number | null;
  assignedTo: string | null;
  assigneeUserId: string | null;
  dependencyTaskId: string | null;
  description: string | null;
  parentTaskId: string | null;
  priority: string;
  taskKind: string;
  contextNote: string | null;
  /** En API SQLite viene como string JSON; el cliente lo interpreta como filas. */
  customFields?: SuiteTaskCustomFieldRow[] | string | null;
  assigneeUser: { id: string; name: string | null; email: string } | null;
  predecessorIds: string[];
  successorIds: string[];
  blocked: boolean;
  /** ISO; presente si el API devuelve el campo Prisma */
  updatedAt?: string;
  /** Historial de actividad de la ficha (más reciente primero). */
  activityLog?: Array<{
    id: string;
    t: number;
    actor: string;
    message: string;
    kind: "field_change" | "comment" | "scheduled" | "time_log";
  }> | null;
};

export async function fetchSuiteProjects(): Promise<SuiteProjectRow[]> {
  const res = await fetch(`${getApiBase()}/projects`, { headers: getAuthHeaders(), cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar los proyectos"));
  }
  return res.json() as Promise<SuiteProjectRow[]>;
}

export async function fetchSuiteProject(id: string): Promise<SuiteProjectDetail> {
  const res = await fetch(`${getApiBase()}/projects/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cargar el proyecto"));
  }
  return res.json() as Promise<SuiteProjectDetail>;
}

/** Panel ejecutivo PMO (GET …/projects/:id/workspace) — alineado a Software de Mejora. */
export type SuiteWorkspaceCommercialLink = {
  id: string;
  externalSystem: string;
  externalRef: string;
  metadata: string | null;
  createdAt: string;
};

export type SuiteWorkspaceMilestoneBucket = {
  id: string;
  name: string;
  description: string | null;
  plannedDate: string;
  actualDate: string | null;
  status: string;
  criticality: string;
};

export type SuiteWorkspaceMilestonesExecutive = {
  overdue: SuiteWorkspaceMilestoneBucket[];
  upcoming: SuiteWorkspaceMilestoneBucket[];
  delayed: SuiteWorkspaceMilestoneBucket[];
  counts: { total: number; open: number; overdue: number; upcoming: number };
};

export type SuiteWorkspacePlanVsReal = {
  progressReal: number;
  progressPlannedWeighted: number;
  progressPlannedCalendar: number;
  deviationPctVsWeighted: number;
  deviationPctVsCalendar: number;
  scheduleSlipDays: number;
  baselineEnd: string;
  projectStart: string;
};

export type SuiteWorkspacePayload = {
  generatedAt: string;
  project: {
    id: string;
    name: string;
    code: string;
    status: string;
    progress: number;
    client: string;
    location: string | null;
    locations?: ProjectLocation[];
    description: string | null;
    startDate: string;
    endDate: string | null;
    commercialLinks: SuiteWorkspaceCommercialLink[];
    counts: {
      tasks: number;
      risks: number;
      documents: number;
      commitments: number;
      resources: number;
    };
  };
  executive: {
    health: "GREEN" | "YELLOW" | "RED" | string;
    reasons: string[];
    factors: Record<string, number>;
  };
  milestonesExecutive: SuiteWorkspaceMilestonesExecutive;
  planVsReal: SuiteWorkspacePlanVsReal;
  taskDependencies: { dependencyEdgeCount: number; blockedTaskCount: number };
  decisionsCount: number;
  commitmentsSummary: { total: number; openOverdue: number; dueNext14Days: number };
  recentCommitments: Array<{
    id: string;
    title: string;
    description: string | null;
    dueDate: string;
    status: string;
    owner: string | null;
    sourceType: string;
    decisionId: string | null;
    milestoneId: string | null;
    riskId: string | null;
  }>;
  recentDecisions: Array<{
    id: string;
    title: string;
    description: string | null;
    decisionDate: string;
    responsible: string | null;
    impact: string;
    category: string;
    status: string;
  }>;
  kpis: {
    progressFromTasks: number;
    progressWeighted: number;
    overdueTasks: number;
    tasksTotal: number;
    tasksDone: number;
    tasksInProgress: number;
    tasksCritical: number;
    activeRisks: number;
    criticalRisks: number;
    risksPastDue: number;
    documentsTotal: number;
    documentsByType: Record<string, number>;
    resourcesAssigned: number;
    resourceOperational: number;
  };
  alerts: Array<{ level: "warning" | "danger" | "info"; code: string; message: string; id?: string }>;
  alertsHistory: Array<{
    id: string;
    type: string;
    message: string;
    severity: string;
    status: string;
    createdAt: string;
    resolvedAt?: string | null;
  }>;
  recentDocuments: Array<{ id: string; name: string; type: string | null; uploadedAt: string }>;
  topRisks: Array<{
    id: string;
    description: string;
    severity: string;
    status: string;
    dueDate: string | null;
    owner: string | null;
  }>;
  assignedResources: Array<{ id: string; name: string; type: string; status: string; notes: string | null }>;
  timeline: Array<{ at: string; kind: string; title: string; detail?: string }>;
  recentChanges: Array<{
    id: string;
    at: string;
    entityType: string;
    action: string;
    user: string;
    summary: string;
  }>;
  workloadBrief: {
    assigneeBuckets: number;
    assigneesWithOverdue: number;
    assigneesWithBlocked: number;
    worstSignal: "ok" | "warning" | "danger" | string;
  };
};

export async function fetchSuiteProjectWorkspace(id: string): Promise<SuiteWorkspacePayload> {
  const res = await fetch(`${getApiBase()}/projects/${encodeURIComponent(id)}/workspace`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cargar el panel del proyecto"));
  }
  return res.json() as Promise<SuiteWorkspacePayload>;
}

export async function fetchSuiteProjectTasks(projectId: string): Promise<SuiteTaskRow[]> {
  const res = await fetch(
    `${getApiBase()}/projects/${encodeURIComponent(projectId)}/tasks`,
    { headers: getAuthHeaders(), cache: "no-store" },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar las tareas del proyecto"));
  }
  return res.json() as Promise<SuiteTaskRow[]>;
}

export type SuiteTaskActivityEntry = {
  id: string;
  t: number;
  actor: string;
  message: string;
  kind: "field_change" | "comment" | "scheduled" | "time_log";
};

export type PatchSuiteTaskInput = {
  status?: string;
  progress?: number;
  name?: string;
  priority?: string;
  description?: string | null;
  contextNote?: string | null;
  customFields?: SuiteTaskCustomFieldRow[];
  /** Fecha inicio planificada (YYYY-MM-DD o ISO) */
  startDate?: string;
  /** Fecha fin planificada */
  endDate?: string;
  /** Añade entradas al historial de actividad (persistido en la tarea). */
  appendActivityEntries?: SuiteTaskActivityEntry[];
  /** Asignación (id de usuario activo) o null para quitar. */
  assigneeUserId?: string | null;
  /** Tarea predecesora / «a la espera de» (mismo proyecto) o null para quitar. */
  dependencyTaskId?: string | null;
};

export type CreateSuiteTaskInput = {
  name: string;
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  parentTaskId?: string;
};

export async function patchSuiteTask(
  projectId: string,
  taskId: string,
  body: PatchSuiteTaskInput,
): Promise<SuiteTaskRow> {
  const res = await fetch(
    `${getApiBase()}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar la tarea"));
  }
  return res.json() as Promise<SuiteTaskRow>;
}

export async function deleteSuiteTask(projectId: string, taskId: string): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "DELETE",
      headers: { ...getAuthHeaders() },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo eliminar la tarea"));
  }
}

export async function createSuiteTask(projectId: string, body: CreateSuiteTaskInput): Promise<SuiteTaskRow> {
  const res = await fetch(`${getApiBase()}/projects/${encodeURIComponent(projectId)}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear la tarea"));
  }
  return res.json() as Promise<SuiteTaskRow>;
}

export type CreateSuiteProjectInput = {
  code: string;
  name: string;
  client?: string;
  status?: string;
  location?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
};

export async function createSuiteProject(body: CreateSuiteProjectInput): Promise<SuiteProjectRow> {
  const res = await fetch(`${getApiBase()}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear el proyecto"));
  }
  return res.json() as Promise<SuiteProjectRow>;
}

export async function replaceProjectLocations(
  projectId: string,
  locations: ProjectLocation[],
): Promise<ProjectLocation[]> {
  const res = await fetch(
    `${getApiBase()}/projects/${encodeURIComponent(projectId)}/locations/replace`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ locations }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron guardar las ubicaciones"));
  }
  return res.json() as Promise<ProjectLocation[]>;
}

export type SuiteBulkImportScheduleRow = {
  name: string;
  startDate: string;
  endDate: string;
  wbsCode?: string | null;
};

export type SuiteBulkImportScheduleResult = { ok: true; created: number; warnings: string[] };

/** Importa tareas desde filas ya normalizadas (YYYY-MM-DD). */
export async function suiteBulkImportTasksSchedule(
  projectId: string,
  rows: SuiteBulkImportScheduleRow[],
): Promise<SuiteBulkImportScheduleResult> {
  const res = await fetch(
    `${getApiBase()}/projects/${encodeURIComponent(projectId)}/tasks/import-schedule`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ rows }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo importar el cronograma"));
  }
  return res.json() as Promise<SuiteBulkImportScheduleResult>;
}

/** Importa tareas desde texto TSV/CSV con cabeceras (mismo parser que el agente). */
export async function suiteBulkImportTasksFromDelimitedText(
  projectId: string,
  text: string,
): Promise<SuiteBulkImportScheduleResult> {
  const res = await fetch(
    `${getApiBase()}/projects/${encodeURIComponent(projectId)}/tasks/import-schedule/from-delimited-text`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ text }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo importar el cronograma desde el archivo"));
  }
  return res.json() as Promise<SuiteBulkImportScheduleResult>;
}

// ——— Inventario / logística suite ———

export type InventoryDestinationKind = "GENERAL" | "SALES_LOCAL" | "PROJECT" | "QUOTE" | "OTHER";

export type InventoryListRow = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  storageLocation: string | null;
  destinationKind: string;
  destinationNote: string | null;
  projectId: string | null;
  quoteId: string | null;
  productId: string | null;
  linksJson: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; code: string; name: string } | null;
  quote: { id: string; title: string; commercialNumber: string | null } | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    category: { id: number; name: string; slug: string } | null;
  } | null;
};

export type CreateInventoryItemInput = {
  sku?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit?: string;
  storageLocation?: string | null;
  destinationKind?: InventoryDestinationKind;
  destinationNote?: string | null;
  projectId?: string | null;
  quoteId?: string | null;
  productId?: string | null;
  linksJson?: string | null;
  logisticsInternationalSnapshotId?: string | null;
};

export type UpdateInventoryItemInput = Partial<CreateInventoryItemInput>;

export async function fetchInventoryItems(filters?: {
  destinationKind?: string;
  projectId?: string;
  quoteId?: string;
  productId?: string;
  search?: string;
  /** Texto del ID de pallet (coincide en ubicación, JSON OQC o descripción). */
  pallet?: string;
}): Promise<InventoryListRow[]> {
  const params = new URLSearchParams();
  if (filters?.destinationKind) params.set("destinationKind", filters.destinationKind);
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.quoteId) params.set("quoteId", filters.quoteId);
  if (filters?.productId) params.set("productId", filters.productId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.pallet) params.set("pallet", filters.pallet);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/inventory${q}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cargar el inventario"));
  }
  return res.json() as Promise<InventoryListRow[]>;
}

export type InventoryKpiDashboard = {
  generatedAt: string;
  projectIdFilter: string | null;
  totals: {
    lineCount: number;
    quantitySum: number;
    estimatedStockValue: number;
    valuationCurrency: string | null;
    linesWithoutLinkedProduct: number;
    linesWithNonActiveCatalogProduct: number;
  };
  byProject: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    lineCount: number;
    quantitySum: number;
    estimatedStockValue: number;
  }>;
  byFamily: Array<{
    key: string;
    label: string;
    lineCount: number;
    quantitySum: number;
  }>;
  topLinesByEstimatedValue: Array<{
    inventoryItemId: string;
    name: string;
    quantity: number;
    estimatedLineValue: number;
    currency: string | null;
    productName: string | null;
  }>;
  nonActiveProductHold: Array<{
    productId: string;
    productName: string;
    commercialStatus: string;
    lineCount: number;
    quantitySum: number;
  }>;
};

export async function fetchInventoryKpiDashboard(filters?: {
  projectId?: string;
}): Promise<InventoryKpiDashboard> {
  const params = new URLSearchParams();
  if (filters?.projectId?.trim()) params.set("projectId", filters.projectId.trim());
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/inventory/kpi-dashboard${q}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar los indicadores de inventario"));
  }
  return res.json() as Promise<InventoryKpiDashboard>;
}

/** Campos de transporte persistidos en `linksJson` (inventario). */
export type InventoryTransportSummary = {
  tripNumber: string | null;
  guideNumber: string | null;
  truckPlate: string | null;
  trailerPlate: string | null;
  conductor: string | null;
  driverRut: string | null;
  driverPhone: string | null;
  transportCompany: string | null;
  logisticsTransportStatus: string | null;
  pickupOrigin: string | null;
  deliveryDestination: string | null;
  deliveryObservation: string | null;
};

/** Agrupación inventario → transporte (OQC / BOM / importación + cruce Excel). */
export type InventoryTransportOverviewGroup = {
  groupKey: string;
  project: { id: string; code: string; name: string } | null;
  palletId: string | null;
  lineCount: number;
  quantitySum: number;
  linesWithTripNumber: number;
  sampleSkus: string[];
  traceabilityLabels: string[];
  logisticsSnapshotId: string | null;
  orderRef: string | null;
  groundTransportRow: Record<string, unknown> | null;
  inventoryTransportSummary: InventoryTransportSummary;
};

export type InventoryTransportOverview = {
  groups: InventoryTransportOverviewGroup[];
  totals: {
    inventoryLinesScanned: number;
    linesIncluded: number;
    groupCount: number;
  };
};

export async function fetchInventoryTransportOverview(filters?: {
  projectId?: string | null;
}): Promise<InventoryTransportOverview> {
  const params = new URLSearchParams();
  if (filters?.projectId?.trim()) params.set("projectId", filters.projectId.trim());
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/inventory/transport-overview${q}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cargar la vista de transporte"));
  }
  return res.json() as Promise<InventoryTransportOverview>;
}

export type ApplyInventoryTransportGroupPatch = {
  tripNumber?: string | null;
  guideNumber?: string | null;
  truckPlate?: string | null;
  trailerPlate?: string | null;
  conductor?: string | null;
  driverRut?: string | null;
  driverPhone?: string | null;
  transportCompany?: string | null;
  logisticsTransportStatus?: string | null;
  pickupOrigin?: string | null;
  deliveryDestination?: string | null;
  deliveryObservation?: string | null;
};

export async function applyInventoryTransportGroup(body: {
  projectId: string;
  palletId: string | null;
  snapshotId?: string | null;
  patch: ApplyInventoryTransportGroupPatch;
}): Promise<{ updatedInventoryLines: number; snapshotTransportUpdated: boolean }> {
  const res = await fetch(`${getApiBase()}/inventory/apply-transport-group`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      projectId: body.projectId,
      palletId: body.palletId,
      snapshotId: body.snapshotId ?? null,
      patch: body.patch,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo guardar el transporte"));
  }
  return res.json() as Promise<{ updatedInventoryLines: number; snapshotTransportUpdated: boolean }>;
}

export async function applyInventoryTransportBulk(body: {
  targets: { projectId: string; palletId: string | null }[];
  snapshotId?: string | null;
  patch: ApplyInventoryTransportGroupPatch;
}): Promise<{ updatedInventoryLines: number; targetsApplied: number; palletsUpdatedInSnapshot: number }> {
  const res = await fetch(`${getApiBase()}/inventory/apply-transport-bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      targets: body.targets,
      snapshotId: body.snapshotId ?? null,
      patch: body.patch,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo aplicar el transporte en bloque"));
  }
  return res.json() as Promise<{
    updatedInventoryLines: number;
    targetsApplied: number;
    palletsUpdatedInSnapshot: number;
  }>;
}

/** Plantilla de precio (maestro comercial transporte). */
export type TransportCommercialTariff = {
  id: string;
  projectId: string | null;
  supplierId: string | null;
  label: string;
  originHint: string | null;
  destinationHint: string | null;
  baseAmount: number;
  currency: string;
  fuelAdjustmentPercent: number | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; code: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
};

/** Acuerdo comercial por grupo proyecto+pallet. */
export type TransportGroupCommercialDeal = {
  id: string;
  groupKey: string;
  projectId: string;
  palletId: string | null;
  tariffId: string | null;
  contractVersionId: string | null;
  templateBaseSnapshot: number | null;
  fuelSurchargePercent: number | null;
  agreedAmount: number | null;
  currency: string;
  manualPrice: boolean;
  commercialNotes: string | null;
  commercialStatus: string;
  createdAt: string;
  updatedAt: string;
  tariff?: TransportCommercialTariff | null;
  contractVersion?: {
    id: string;
    versionNumber: number;
    label: string | null;
    status: string;
    contract: { id: string; title: string; supplierId: string; projectId: string | null };
  } | null;
};

export async function fetchTransportCommercialTariffs(filters?: {
  projectId?: string | null;
  supplierId?: string | null;
}): Promise<TransportCommercialTariff[]> {
  const params = new URLSearchParams();
  if (filters?.projectId?.trim()) params.set("projectId", filters.projectId.trim());
  if (filters?.supplierId?.trim()) params.set("supplierId", filters.supplierId.trim());
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/inventory/transport-commercial/tariffs${q}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar las plantillas comerciales"));
  }
  return res.json() as Promise<TransportCommercialTariff[]>;
}

export async function createTransportCommercialTariff(body: {
  projectId?: string | null;
  supplierId?: string | null;
  label: string;
  originHint?: string | null;
  destinationHint?: string | null;
  baseAmount: number;
  currency?: string;
  fuelAdjustmentPercent?: number | null;
  notes?: string | null;
  active?: boolean;
}): Promise<TransportCommercialTariff> {
  const res = await fetch(`${getApiBase()}/inventory/transport-commercial/tariffs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear la plantilla"));
  }
  return res.json() as Promise<TransportCommercialTariff>;
}

export async function updateTransportCommercialTariff(
  id: string,
  body: Partial<{
    projectId: string | null;
    supplierId: string | null;
    label: string;
    originHint: string | null;
    destinationHint: string | null;
    baseAmount: number;
    currency: string;
    fuelAdjustmentPercent: number | null;
    notes: string | null;
    active: boolean;
  }>,
): Promise<TransportCommercialTariff> {
  const res = await fetch(`${getApiBase()}/inventory/transport-commercial/tariffs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar la plantilla"));
  }
  return res.json() as Promise<TransportCommercialTariff>;
}

export async function deleteTransportCommercialTariff(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${getApiBase()}/inventory/transport-commercial/tariffs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo eliminar la plantilla"));
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export async function fetchTransportCommercialDealsBatch(
  groupKeys: string[],
): Promise<TransportGroupCommercialDeal[]> {
  const uniq = [...new Set(groupKeys.map((k) => k.trim()).filter(Boolean))];
  if (!uniq.length) return [];
  const params = new URLSearchParams();
  params.set("groupKeys", uniq.join(","));
  const res = await fetch(`${getApiBase()}/inventory/transport-commercial/deals?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar acuerdos comerciales"));
  }
  const json = (await res.json()) as { deals?: TransportGroupCommercialDeal[] };
  return json.deals ?? [];
}

export async function upsertTransportGroupCommercial(body: {
  groupKey: string;
  projectId: string;
  palletId?: string | null;
  tariffId?: string | null;
  contractVersionId?: string | null;
  fuelSurchargePercent?: number | null;
  agreedAmount?: number | null;
  currency?: string;
  manualPrice?: boolean;
  commercialNotes?: string | null;
  commercialStatus?: string;
}): Promise<TransportGroupCommercialDeal> {
  const res = await fetch(`${getApiBase()}/inventory/transport-commercial/deals`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo guardar el acuerdo comercial"));
  }
  return res.json() as Promise<TransportGroupCommercialDeal>;
}

/** Ítem de tarifario contractual (anexo por versión). */
export type TransportTariffItem = {
  id: string;
  contractVersionId: string;
  code: string | null;
  label: string;
  unit: string;
  amount: number;
  currency: string;
  taxMode: string;
  legalRef: string | null;
  sortOrder: number;
  notes: string | null;
  activeFrom?: string | null;
  activeTo?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Excepción / rider (Fase 1) sobre una versión del tarifario. */
export type TransportTariffOverrideRow = {
  id: string;
  contractVersionId: string;
  baseTariffItemId: string | null;
  action: string;
  label: string;
  amount: number;
  currency: string;
  unit: string;
  taxMode: string;
  legalRef: string | null;
  reason: string;
  documentRef: string | null;
  validFrom: string;
  validTo: string | null;
  sortOrder: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  baseItem: { id: string; label: string; code: string | null } | null;
};

export type TransportContractVersionDetail = {
  id: string;
  contractId: string;
  versionNumber: number;
  status: string;
  label: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  publishedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: TransportTariffItem[];
  overrides?: TransportTariffOverrideRow[];
  _count?: { deals: number };
};

export type TransportContractListRow = {
  id: string;
  supplierId: string;
  projectId: string | null;
  title: string;
  contractNumber: string | null;
  clientLegalName: string | null;
  contractorLegalName: string | null;
  signedAt: string | null;
  paymentTerms: string | null;
  jurisdiction: string | null;
  defaultCurrency: string;
  defaultVatPercent: number;
  notes: string | null;
  active: boolean;
  transportVariableProfileId?: string | null;
  transportVariableProfile?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  supplier: { id: string; name: string; actorType: string };
  project: { id: string; code: string; name: string } | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    status: string;
    label: string | null;
    publishedAt: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    _count: { items: number; overrides?: number };
  }>;
};

export type TransportContractDetail = TransportContractListRow & {
  versions: TransportContractVersionDetail[];
};

export type PublishedContractVersionOption = TransportContractVersionDetail & {
  contract: {
    id: string;
    title: string;
    projectId: string | null;
    supplierId: string;
    supplier: { id: string; name: string };
    project: { id: string; code: string; name: string } | null;
  };
};

export async function fetchTransportContracts(filters?: {
  projectId?: string | null;
  supplierId?: string | null;
  activeOnly?: boolean;
}): Promise<TransportContractListRow[]> {
  const params = new URLSearchParams();
  if (filters?.projectId?.trim()) params.set("projectId", filters.projectId.trim());
  if (filters?.supplierId?.trim()) params.set("supplierId", filters.supplierId.trim());
  if (filters?.activeOnly === false) params.set("activeOnly", "false");
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/inventory/transport-contracts${q}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar los contratos"));
  }
  return res.json() as Promise<TransportContractListRow[]>;
}

export async function fetchTransportContract(id: string): Promise<TransportContractDetail> {
  const res = await fetch(`${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cargar el contrato"));
  }
  return res.json() as Promise<TransportContractDetail>;
}

export async function createTransportContract(body: {
  supplierId: string;
  projectId?: string | null;
  title: string;
  contractNumber?: string | null;
  clientLegalName?: string | null;
  contractorLegalName?: string | null;
  signedAt?: string | null;
  paymentTerms?: string | null;
  jurisdiction?: string | null;
  defaultCurrency?: string;
  defaultVatPercent?: number;
  notes?: string | null;
  active?: boolean;
}): Promise<TransportContractDetail> {
  const res = await fetch(`${getApiBase()}/inventory/transport-contracts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear el contrato"));
  }
  return res.json() as Promise<TransportContractDetail>;
}

export async function updateTransportContract(
  id: string,
  body: Partial<{
    supplierId: string;
    projectId: string | null;
    title: string;
    contractNumber: string | null;
    clientLegalName: string | null;
    contractorLegalName: string | null;
    signedAt: string | null;
    paymentTerms: string | null;
    jurisdiction: string | null;
    defaultCurrency: string;
    defaultVatPercent: number;
    notes: string | null;
    active: boolean;
    transportVariableProfileId: string | null;
  }>,
): Promise<TransportContractDetail> {
  const res = await fetch(`${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar el contrato"));
  }
  return res.json() as Promise<TransportContractDetail>;
}

export async function deleteTransportContract(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo archivar el contrato"));
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export async function createTransportContractVersion(
  contractId: string,
  body: {
    copyFromVersionId?: string | null;
    label?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    notes?: string | null;
  },
): Promise<TransportContractVersionDetail> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear la versión"));
  }
  return res.json() as Promise<TransportContractVersionDetail>;
}

export async function fetchTransportContractVersion(
  contractId: string,
  versionId: string,
): Promise<TransportContractVersionDetail> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cargar la versión"));
  }
  return res.json() as Promise<TransportContractVersionDetail>;
}

export async function updateTransportContractVersion(
  contractId: string,
  versionId: string,
  body: {
    label?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    notes?: string | null;
  },
): Promise<TransportContractVersionDetail> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar la versión"));
  }
  return res.json() as Promise<TransportContractVersionDetail>;
}

export async function publishTransportContractVersion(
  contractId: string,
  versionId: string,
): Promise<TransportContractVersionDetail> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/publish`,
    { method: "POST", headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo publicar la versión"));
  }
  return res.json() as Promise<TransportContractVersionDetail>;
}

export async function createTransportTariffItem(
  contractId: string,
  versionId: string,
  body: {
    code?: string | null;
    label: string;
    unit: string;
    amount: number;
    currency?: string;
    taxMode: string;
    legalRef?: string | null;
    sortOrder?: number;
    notes?: string | null;
    activeFrom?: string | null;
    activeTo?: string | null;
  },
): Promise<TransportTariffItem> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear el ítem"));
  }
  return res.json() as Promise<TransportTariffItem>;
}

export async function updateTransportTariffItem(
  contractId: string,
  versionId: string,
  itemId: string,
  body: Partial<{
    code: string | null;
    label: string;
    unit: string;
    amount: number;
    currency: string;
    taxMode: string;
    legalRef: string | null;
    sortOrder: number;
    notes: string | null;
    activeFrom: string | null;
    activeTo: string | null;
  }>,
): Promise<TransportTariffItem> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar el ítem"));
  }
  return res.json() as Promise<TransportTariffItem>;
}

export async function deleteTransportTariffItem(
  contractId: string,
  versionId: string,
  itemId: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE", headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo eliminar el ítem"));
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export async function createTransportTariffOverride(
  contractId: string,
  versionId: string,
  body: {
    baseTariffItemId?: string | null;
    action?: string;
    label: string;
    amount: number;
    currency?: string;
    unit: string;
    taxMode: string;
    legalRef?: string | null;
    reason: string;
    documentRef?: string | null;
    validFrom: string;
    validTo?: string | null;
    sortOrder?: number;
    notes?: string | null;
  },
): Promise<TransportTariffOverrideRow> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/overrides`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear la excepción"));
  }
  return res.json() as Promise<TransportTariffOverrideRow>;
}

export async function updateTransportTariffOverride(
  contractId: string,
  versionId: string,
  overrideId: string,
  body: Partial<{
    baseTariffItemId: string | null;
    action: string;
    label: string;
    amount: number;
    currency: string;
    unit: string;
    taxMode: string;
    legalRef: string | null;
    reason: string;
    documentRef: string | null;
    validFrom: string;
    validTo: string | null;
    sortOrder: number;
    notes: string | null;
  }>,
): Promise<TransportTariffOverrideRow> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/overrides/${encodeURIComponent(overrideId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar la excepción"));
  }
  return res.json() as Promise<TransportTariffOverrideRow>;
}

export async function deleteTransportTariffOverride(
  contractId: string,
  versionId: string,
  overrideId: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/overrides/${encodeURIComponent(overrideId)}`,
    { method: "DELETE", headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo eliminar la excepción"));
  }
  return res.json() as Promise<{ ok: boolean }>;
}

/** Igual que backend: clave de grupo transporte / acuerdo comercial. */
export function expectedTransportGroupKey(projectId: string, palletId: string | null | undefined): string {
  const pid = (palletId ?? "").trim();
  return `${projectId}|${pid ? pid : "_sin_pallet"}`;
}

export type TransportTripCostLineRow = {
  id: string;
  tripId: string;
  sortOrder: number;
  concept: string;
  amount: number;
  currency: string;
  sourceKind: string;
  sourceRef: string | null;
  notes: string | null;
  createdAt: string;
};

export type TransportTripCommercialListRow = {
  id: string;
  projectId: string;
  groupKey: string;
  palletId: string | null;
  tripNumber: string;
  supplierId: string | null;
  tripDate: string;
  scenario: string;
  kmUsed: number | null;
  litersUsed: number | null;
  extraChargesNote: string | null;
  status: string;
  currency: string;
  subtotal: number | null;
  vatAmount: number | null;
  total: number | null;
  contractVersionId: string | null;
  variableProfileId: string | null;
  notes: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; code: string; name: string };
  supplier: { id: string; name: string } | null;
  contractVersion: {
    id: string;
    versionNumber: number;
    status: string;
    contractId: string;
  } | null;
  _count: { lines: number };
};

/** Resolución de variables de transporte a la fecha del viaje (Fase 4). */
export type TransportTripInputsResolvedRow = {
  variableId: string;
  key: string;
  label: string;
  defaultUnit: string | null;
  resolved: {
    valueId: string;
    value: number;
    unit: string | null;
    validFrom: string;
    validTo: string | null;
    source: string;
    profileId: string | null;
  } | null;
};

export type TransportTripCommercialDetail = Omit<TransportTripCommercialListRow, "contractVersion"> & {
  lines: TransportTripCostLineRow[];
  contractVersion:
    | (NonNullable<TransportTripCommercialListRow["contractVersion"]> & {
        contract: { id: string; title: string; defaultVatPercent: number; defaultCurrency: string };
      })
    | null;
  variableProfile: { id: string; name: string } | null;
  /** Perfil usado para resolver inputs (contrato → proyecto). */
  inputsResolvedAtProfileId: string | null;
  inputsResolved: TransportTripInputsResolvedRow[];
};

export async function fetchTransportTrips(filters?: {
  projectId?: string | null;
  groupKey?: string | null;
  status?: string | null;
}): Promise<TransportTripCommercialListRow[]> {
  const params = new URLSearchParams();
  if (filters?.projectId?.trim()) params.set("projectId", filters.projectId.trim());
  if (filters?.groupKey?.trim()) params.set("groupKey", filters.groupKey.trim());
  if (filters?.status?.trim()) params.set("status", filters.status.trim());
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/inventory/transport-trips${q}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar los viajes comerciales"));
  }
  return res.json() as Promise<TransportTripCommercialListRow[]>;
}

export async function fetchTransportTrip(id: string): Promise<TransportTripCommercialDetail> {
  const res = await fetch(`${getApiBase()}/inventory/transport-trips/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cargar el viaje"));
  }
  return res.json() as Promise<TransportTripCommercialDetail>;
}

export async function createTransportTrip(body: {
  projectId: string;
  groupKey: string;
  palletId?: string | null;
  tripNumber: string;
  tripDate?: string | null;
  scenario?: string | null;
  supplierId?: string | null;
  kmUsed?: number | null;
  litersUsed?: number | null;
  extraChargesNote?: string | null;
  notes?: string | null;
}): Promise<TransportTripCommercialListRow> {
  const res = await fetch(`${getApiBase()}/inventory/transport-trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear el viaje"));
  }
  return res.json() as Promise<TransportTripCommercialListRow>;
}

export async function updateTransportTrip(
  id: string,
  body: Partial<{
    tripDate: string | null;
    scenario: string | null;
    supplierId: string | null;
    kmUsed: number | null;
    litersUsed: number | null;
    extraChargesNote: string | null;
    notes: string | null;
  }>,
): Promise<TransportTripCommercialDetail> {
  const res = await fetch(`${getApiBase()}/inventory/transport-trips/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar el viaje"));
  }
  return res.json() as Promise<TransportTripCommercialDetail>;
}

export async function recalculateTransportTrip(id: string): Promise<TransportTripCommercialDetail> {
  const res = await fetch(`${getApiBase()}/inventory/transport-trips/${encodeURIComponent(id)}/recalculate`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo recalcular"));
  }
  return res.json() as Promise<TransportTripCommercialDetail>;
}

export async function closeTransportTrip(id: string): Promise<TransportTripCommercialDetail> {
  const res = await fetch(`${getApiBase()}/inventory/transport-trips/${encodeURIComponent(id)}/close`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cerrar el viaje"));
  }
  return res.json() as Promise<TransportTripCommercialDetail>;
}

export async function fetchPublishedTransportContractVersions(filters?: {
  projectId?: string | null;
  supplierId?: string | null;
}): Promise<PublishedContractVersionOption[]> {
  const params = new URLSearchParams();
  if (filters?.projectId?.trim()) params.set("projectId", filters.projectId.trim());
  if (filters?.supplierId?.trim()) params.set("supplierId", filters.supplierId.trim());
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/inventory/transport-contracts/published-versions${q}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar versiones publicadas"));
  }
  return res.json() as Promise<PublishedContractVersionOption[]>;
}

// ——— Transporte: variables de mercado (Fase 2 — Inputs) ———

export type TransportVariableProfileRow = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { values: number; contracts: number; projects: number };
};

export type TransportVariableCatalogRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  defaultUnit: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { values: number };
};

export type TransportVariableValueRow = {
  id: string;
  variableId: string;
  profileId: string | null;
  value: number;
  unit: string | null;
  validFrom: string;
  validTo: string | null;
  source: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  profile: { id: string; name: string } | null;
};

export type TransportVariableDetail = TransportVariableCatalogRow & {
  values: TransportVariableValueRow[];
};

export type TransportVariableResolvedRow = {
  variableId: string;
  key: string;
  label: string;
  defaultUnit: string | null;
  resolved: {
    valueId: string;
    value: number;
    unit: string | null;
    validFrom: string;
    validTo: string | null;
    source: string;
    profileId: string | null;
  } | null;
};

export async function fetchTransportVariableProfiles(): Promise<TransportVariableProfileRow[]> {
  const res = await fetch(`${getApiBase()}/inventory/transport-variables/profiles`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar los perfiles"));
  }
  return res.json() as Promise<TransportVariableProfileRow[]>;
}

export async function createTransportVariableProfile(body: {
  name: string;
  notes?: string | null;
}): Promise<{ id: string; name: string; notes: string | null }> {
  const res = await fetch(`${getApiBase()}/inventory/transport-variables/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear el perfil"));
  }
  return res.json() as Promise<{ id: string; name: string; notes: string | null }>;
}

export async function updateTransportVariableProfile(
  id: string,
  body: { name?: string; notes?: string | null },
): Promise<{ id: string; name: string; notes: string | null }> {
  const res = await fetch(`${getApiBase()}/inventory/transport-variables/profiles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar el perfil"));
  }
  return res.json() as Promise<{ id: string; name: string; notes: string | null }>;
}

export async function deleteTransportVariableProfile(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${getApiBase()}/inventory/transport-variables/profiles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo eliminar el perfil"));
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export async function fetchTransportVariablesCatalog(): Promise<TransportVariableCatalogRow[]> {
  const res = await fetch(`${getApiBase()}/inventory/transport-variables`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar las variables"));
  }
  return res.json() as Promise<TransportVariableCatalogRow[]>;
}

export async function fetchTransportVariable(id: string): Promise<TransportVariableDetail> {
  const res = await fetch(`${getApiBase()}/inventory/transport-variables/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cargar la variable"));
  }
  return res.json() as Promise<TransportVariableDetail>;
}

export async function createTransportVariable(body: {
  key: string;
  label: string;
  description?: string | null;
  defaultUnit?: string | null;
  active?: boolean;
}): Promise<TransportVariableCatalogRow> {
  const res = await fetch(`${getApiBase()}/inventory/transport-variables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear la variable"));
  }
  return res.json() as Promise<TransportVariableCatalogRow>;
}

export async function updateTransportVariable(
  id: string,
  body: Partial<{ label: string; description: string | null; defaultUnit: string | null; active: boolean }>,
): Promise<TransportVariableCatalogRow> {
  const res = await fetch(`${getApiBase()}/inventory/transport-variables/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar la variable"));
  }
  return res.json() as Promise<TransportVariableCatalogRow>;
}

export async function deleteTransportVariable(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${getApiBase()}/inventory/transport-variables/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo desactivar la variable"));
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export async function fetchTransportVariableValues(
  variableId: string,
  profileId?: string | null,
): Promise<TransportVariableValueRow[]> {
  const params = new URLSearchParams();
  if (profileId !== undefined && profileId !== null && profileId !== "") params.set("profileId", profileId);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(
    `${getApiBase()}/inventory/transport-variables/${encodeURIComponent(variableId)}/values${q}`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar los valores"));
  }
  return res.json() as Promise<TransportVariableValueRow[]>;
}

export async function createTransportVariableValue(
  variableId: string,
  body: {
    value: number;
    unit?: string | null;
    validFrom: string;
    validTo?: string | null;
    profileId?: string | null;
    source?: string;
    note?: string | null;
  },
): Promise<TransportVariableValueRow> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-variables/${encodeURIComponent(variableId)}/values`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear el valor"));
  }
  return res.json() as Promise<TransportVariableValueRow>;
}

export async function updateTransportVariableValue(
  variableId: string,
  valueId: string,
  body: Partial<{
    value: number;
    unit: string | null;
    validFrom: string;
    validTo: string | null;
    profileId: string | null;
    source: string;
    note: string | null;
  }>,
): Promise<TransportVariableValueRow> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-variables/${encodeURIComponent(variableId)}/values/${encodeURIComponent(valueId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar el valor"));
  }
  return res.json() as Promise<TransportVariableValueRow>;
}

export async function deleteTransportVariableValue(
  variableId: string,
  valueId: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `${getApiBase()}/inventory/transport-variables/${encodeURIComponent(variableId)}/values/${encodeURIComponent(valueId)}`,
    { method: "DELETE", headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo eliminar el valor"));
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export async function resolveTransportVariablesAt(filters: {
  at?: string;
  profileId?: string | null;
  keys?: string[];
}): Promise<TransportVariableResolvedRow[]> {
  const params = new URLSearchParams();
  if (filters.at?.trim()) params.set("at", filters.at.trim());
  if (filters.profileId?.trim()) params.set("profileId", filters.profileId.trim());
  if (filters.keys?.length) params.set("keys", filters.keys.join(","));
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/inventory/transport-variables/resolve${q}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo resolver variables"));
  }
  return res.json() as Promise<TransportVariableResolvedRow[]>;
}

/** Línea devuelta por extracción IA de BOM (PDF proveedor). */
export type SupplierBomDraftLine = {
  bomLineNo: number | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  supplierName: string;
  supplierQuoteRef: string | null;
  materialGrade: string | null;
  specText: string | null;
  componentLabel: string | null;
  spareQty: number | null;
  qtyPerKit: number | null;
  unitKit: number | null;
  unitWeightKg: number | null;
  totalWeightKg: number | null;
};

export type ExtractSupplierBomDraftResponse = {
  lines: SupplierBomDraftLine[];
  warnings: string[];
  textCharsTotal: number;
  textCharsUsed: number;
  model: string;
  chunksProcessed: number;
};

export type RefineSupplierBomDraftAiResponse = {
  lines: SupplierBomDraftLine[];
  warnings: string[];
  model: string;
};

export async function extractSupplierBomDraft(
  file: File,
  extraInstructions?: string | null,
): Promise<ExtractSupplierBomDraftResponse> {
  const form = new FormData();
  form.append("file", file);
  const hint = extraInstructions?.trim();
  if (hint) form.append("extraInstructions", hint.slice(0, 3000));
  const res = await fetch(`${getApiBase()}/inventory/extract-supplier-bom-draft`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo interpretar el documento con IA"));
  }
  return res.json() as Promise<ExtractSupplierBomDraftResponse>;
}

export async function refineSupplierBomDraftAi(body: {
  lines: SupplierBomDraftLine[];
  instruction: string;
}): Promise<RefineSupplierBomDraftAiResponse> {
  const res = await fetch(`${getApiBase()}/inventory/refine-supplier-bom-draft-ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      lines: body.lines,
      instruction: body.instruction.trim().slice(0, 4000),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo refinar el borrador con IA"));
  }
  return res.json() as Promise<RefineSupplierBomDraftAiResponse>;
}

export type ImportSupplierBomConfirmedInput = {
  projectId: string;
  supplierName: string;
  supplierQuoteRef?: string | null;
  sourceFileName?: string | null;
  skipDuplicates?: boolean;
  lines: Array<{
    bomLineNo?: number | null;
    name: string;
    description?: string | null;
    quantity: number;
    unit?: string;
    materialGrade?: string | null;
    specText?: string | null;
    componentLabel?: string | null;
    spareQty?: number | null;
    qtyPerKit?: number | null;
    unitKit?: number | null;
    unitWeightKg?: number | null;
    totalWeightKg?: number | null;
  }>;
};

export async function importSupplierBomConfirmed(
  body: ImportSupplierBomConfirmedInput,
): Promise<{ created: number; skipped: number; importRunId: string }> {
  const res = await fetch(`${getApiBase()}/inventory/import-supplier-bom-confirmed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo importar el BOM"));
  }
  return res.json() as Promise<{ created: number; skipped: number; importRunId: string }>;
}

export async function createInventoryItem(body: CreateInventoryItemInput): Promise<InventoryListRow> {
  const res = await fetch(`${getApiBase()}/inventory`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo crear el ítem"));
  }
  return res.json() as Promise<InventoryListRow>;
}

export type ImportOqcPanelsInput = {
  projectCode?: string;
  projectId?: string;
  productId?: string | null;
  reportRef?: string | null;
  sourceFileHint?: string | null;
  preset?: "EGE2026_OQC_2356";
  panels?: Array<{
    serialNumber: string;
    palletNumber?: string;
    itemN?: number;
    ffPercent?: number;
    isc?: number;
    voc?: number;
    imp?: number;
    vmp?: number;
    pmW?: number;
  }>;
};

export type ImportOqcPanelsResult = {
  projectId: string;
  projectCode: string;
  created: number;
  skipped: number;
  createdIds: string[];
  productLinked: boolean;
};

export type ImportOqcSpreadsheetResult = ImportOqcPanelsResult & {
  rowsInFile: number;
  sheetsTried: string[];
  parseWarnings: string[];
};

export type InventoryDuplicateSerialRow = { id: string; name: string; createdAt: string };
export type InventoryDuplicateSerialGroup = {
  sku: string | null;
  skuNormalized: string;
  count: number;
  rows: InventoryDuplicateSerialRow[];
};
export type InventoryDuplicateSerialsResponse = {
  projectId: string;
  duplicateSerials: InventoryDuplicateSerialGroup[];
  extraDuplicateRows: number;
};

export type DeduplicateInventorySerialsResult = {
  projectId: string;
  deleted: number;
  duplicateSerialsResolved: number;
  keep: "OLDEST" | "NEWEST";
};

export type RelinkOqcCatalogResult = {
  projectId: string;
  rowsTouched: number;
  productRelinks: number;
  productUnlinks: number;
  linksJsonEnriched: number;
  targetProductId: string | null;
  targetProductName: string | null;
  targetAcceptableFor720Report: boolean;
};

/** Lote OQC: un ítem de inventario por número de serie, destino proyecto, datos en description/linksJson. */
export async function importOqcInventoryPanels(body: ImportOqcPanelsInput): Promise<ImportOqcPanelsResult> {
  const res = await fetch(`${getApiBase()}/inventory/import-oqc-panels`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo importar el lote OQC"));
  }
  return res.json() as Promise<ImportOqcPanelsResult>;
}

/** Importación masiva desde CSV/XLSX del informe OQC (miles de filas con serial, pallet, medidas). */
export async function importOqcInventorySpreadsheet(
  file: File,
  params: {
    projectId?: string;
    projectCode?: string;
    productId?: string;
    reportRef?: string;
    sourceFileHint?: string;
  },
): Promise<ImportOqcSpreadsheetResult> {
  const fd = new FormData();
  fd.append("file", file);
  const q = new URLSearchParams();
  if (params.projectId?.trim()) q.set("projectId", params.projectId.trim());
  if (params.projectCode?.trim()) q.set("projectCode", params.projectCode.trim());
  if (params.productId?.trim()) q.set("productId", params.productId.trim());
  if (params.reportRef?.trim()) q.set("reportRef", params.reportRef.trim());
  if (params.sourceFileHint?.trim()) q.set("sourceFileHint", params.sourceFileHint.trim());
  const qs = q.toString();
  const res = await fetch(`${getApiBase()}/inventory/import-oqc-file${qs ? `?${qs}` : ""}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo importar el archivo OQC"));
  }
  return res.json() as Promise<ImportOqcSpreadsheetResult>;
}

export async function fetchInventoryDuplicateSerials(projectId: string): Promise<InventoryDuplicateSerialsResponse> {
  const q = new URLSearchParams({ projectId: projectId.trim() });
  const res = await fetch(`${getApiBase()}/inventory/duplicate-serials?${q}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo analizar duplicados"));
  }
  return res.json() as Promise<InventoryDuplicateSerialsResponse>;
}

export async function deduplicateInventorySerials(body: {
  projectId: string;
  keep: "OLDEST" | "NEWEST";
}): Promise<DeduplicateInventorySerialsResult> {
  const res = await fetch(`${getApiBase()}/inventory/deduplicate-serials`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo eliminar duplicados"));
  }
  return res.json() as Promise<DeduplicateInventorySerialsResult>;
}

/** Re-vincula catálogo OQC al producto 720 W preferente y completa modelo en linksJson (filas ya importadas). */
export async function relinkOqcInventoryCatalog(body: { projectId: string }): Promise<RelinkOqcCatalogResult> {
  const res = await fetch(`${getApiBase()}/inventory/relink-oqc-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ projectId: body.projectId.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar el vínculo al catálogo OQC"));
  }
  return res.json() as Promise<RelinkOqcCatalogResult>;
}

/** Borra ítems de inventario del proyecto (no borra productos del catálogo comercial). */
export type PurgeProjectInventoryResult = {
  projectId: string;
  projectCode: string;
  scope: "OQC_PANELS_ONLY" | "ALL_PROJECT_DESTINATION";
  deleted: number;
  scanned: number;
};

export async function purgeProjectInventoryItems(body: {
  projectId: string;
  securityPin: string;
  scope: "OQC_PANELS_ONLY" | "ALL_PROJECT_DESTINATION";
}): Promise<PurgeProjectInventoryResult> {
  const res = await fetch(`${getApiBase()}/inventory/purge-project-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      projectId: body.projectId.trim(),
      securityPin: body.securityPin.trim(),
      scope: body.scope,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo vaciar el inventario del proyecto"));
  }
  return res.json() as Promise<PurgeProjectInventoryResult>;
}

export async function updateInventoryItem(id: string, body: UpdateInventoryItemInput): Promise<InventoryListRow> {
  const res = await fetch(`${getApiBase()}/inventory/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar el ítem"));
  }
  return res.json() as Promise<InventoryListRow>;
}

export async function deleteInventoryItem(id: string): Promise<{ ok: true; id: string }> {
  const res = await fetch(`${getApiBase()}/inventory/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo eliminar el ítem"));
  }
  return res.json() as Promise<{ ok: true; id: string }>;
}

/** Importación del Excel «Logística internacional» (Base Paneles, Pallets, Datos Base, transporte). */
export type LogisticsInternationalSummary = {
  headline: string;
  productLine: string;
  panelCount: number;
  palletCount: number;
  routeText: string;
  orderRef: string | null;
};

export type LogisticsSnapshotListRow = {
  id: string;
  projectId: string | null;
  title: string;
  orderRef: string | null;
  sourceFileName: string | null;
  summary: LogisticsInternationalSummary;
  createdAt: string;
  updatedAt: string;
  project: { id: string; code: string; name: string } | null;
};

export type LogisticsPalletTraceabilityRow = {
  palletId: string;
  container: string | null;
  estado: string | null;
  panelCount: number;
  sampleSerials: string[];
  transportista: string | null;
  conductor: string | null;
  rutConductor: string | null;
  patenteCamion: string | null;
  patenteRampla: string | null;
  fechaSalidaChina: string | null;
  fechaLlegadaChile: string | null;
  fechaDesconsolidacion: string | null;
  fechaSalidaCoyhaique: string | null;
  fechaLlegadaCoyhaique: string | null;
  fechaDespachoReal: string | null;
  diasMaritimos: string | null;
  diasCoyhaique: string | null;
  diasEnRuta: string | null;
  cantidadPaneles: string | null;
  potenciaTotalW: string | null;
  potenciaPromedioW: string | null;
  trazabilidadExcel: string | null;
  trazabilidadCompletaCalc: boolean;
  fuentePdf: string | null;
  observaciones: string | null;
};

export type LogisticsDerivedPayload = {
  pallets: LogisticsPalletTraceabilityRow[];
  stats: {
    palletRows: number;
    panelRows: number;
    transportRows: number;
    panelsLinkedToPallet: number;
    palletsCompleteBySheet: number;
    palletsCompleteByCalc: number;
  };
};

export type LogisticsSnapshotDetail = LogisticsSnapshotListRow & {
  panels: Record<string, unknown>[];
  pallets: Record<string, unknown>[];
  shipments: Record<string, unknown>[];
  groundTransport: Record<string, unknown>[];
  derived?: LogisticsDerivedPayload;
};

export type LogisticsImportResult = {
  snapshot: LogisticsSnapshotListRow;
  inventoryItem: InventoryListRow;
  counts: { panels: number; pallets: number; shipments: number; groundTransport: number };
};

export async function fetchLogisticsSnapshots(projectId?: string): Promise<LogisticsSnapshotListRow[]> {
  const q = projectId?.trim() ? `?projectId=${encodeURIComponent(projectId.trim())}` : "";
  const res = await fetch(`${getApiBase()}/logistics-international/snapshots${q}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron cargar las importaciones"));
  }
  return res.json() as Promise<LogisticsSnapshotListRow[]>;
}

export async function fetchLogisticsSnapshotDetail(id: string): Promise<LogisticsSnapshotDetail> {
  const res = await fetch(`${getApiBase()}/logistics-international/snapshots/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo cargar el detalle"));
  }
  return res.json() as Promise<LogisticsSnapshotDetail>;
}

export async function deleteLogisticsSnapshot(id: string): Promise<{ ok: true; id: string }> {
  const res = await fetch(`${getApiBase()}/logistics-international/snapshots/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo eliminar la importación"));
  }
  return res.json() as Promise<{ ok: true; id: string }>;
}

export async function importLogisticsInternationalExcel(
  file: File,
  projectId?: string | null,
): Promise<LogisticsImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  const q = projectId?.trim() ? `?projectId=${encodeURIComponent(projectId.trim())}` : "";
  const res = await fetch(`${getApiBase()}/logistics-international/import${q}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo importar el archivo"));
  }
  return res.json() as Promise<LogisticsImportResult>;
}

export async function patchLogisticsSnapshotShipments(
  snapshotId: string,
  shipments: Record<string, unknown>[],
): Promise<LogisticsSnapshotDetail> {
  const res = await fetch(`${getApiBase()}/logistics-international/snapshots/${encodeURIComponent(snapshotId)}/shipments`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ shipments }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron guardar los embarques"));
  }
  return res.json() as Promise<LogisticsSnapshotDetail>;
}

export async function patchLogisticsSnapshotPallets(
  snapshotId: string,
  pallets: Record<string, unknown>[],
): Promise<LogisticsSnapshotDetail> {
  const res = await fetch(`${getApiBase()}/logistics-international/snapshots/${encodeURIComponent(snapshotId)}/pallets`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ pallets }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudieron guardar los pallets"));
  }
  return res.json() as Promise<LogisticsSnapshotDetail>;
}

export async function patchLogisticsSnapshotTransport(
  snapshotId: string,
  groundTransport: Record<string, unknown>[],
): Promise<LogisticsSnapshotDetail> {
  const res = await fetch(`${getApiBase()}/logistics-international/snapshots/${encodeURIComponent(snapshotId)}/transport`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ groundTransport }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo guardar el transporte"));
  }
  return res.json() as Promise<LogisticsSnapshotDetail>;
}

/** Descarga el Excel generado desde una importación (requiere sesión). */
export async function downloadLogisticsSnapshotExport(snapshotId: string): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/logistics-international/snapshots/${encodeURIComponent(snapshotId)}/export.xlsx`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo exportar"));
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  const m = cd?.match(/filename="?([^";]+)"?/i);
  const name = m?.[1]?.trim() || `logistica-${snapshotId}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export type UpdateSuiteProjectInput = Partial<CreateSuiteProjectInput> & {
  taskStatusConfig?: Record<string, unknown>;
  logisticsTransportStatusConfig?: Record<string, unknown>;
  transportVariableProfileId?: string | null;
};

export async function updateSuiteProject(id: string, body: UpdateSuiteProjectInput): Promise<SuiteProjectRow> {
  const res = await fetch(`${getApiBase()}/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo actualizar el proyecto"));
  }
  return res.json() as Promise<SuiteProjectRow>;
}

// ——— Dashboard D2: indicadores externos Chile ———
export type ExternalIndicatorItem = {
  value: number | null;
  fecha: string | null;
  unidad: string | null;
  error?: boolean;
};
export type ExternalIndicatorsData = {
  dolar: ExternalIndicatorItem;
  uf: ExternalIndicatorItem;
  ipc: ExternalIndicatorItem;
  updatedAt: string | null;
  source: string;
  error?: string;
};

export async function fetchExternalIndicators(): Promise<ExternalIndicatorsData> {
  const res = await fetch(`${getApiBase()}/dashboard/external-indicators`, { headers: getAuthHeaders() });
  if (!res.ok) return getEmptyExternalIndicators("Indicadores no disponibles");
  return res.json();
}

// ——— Dashboard: series históricas indicadores externos ———
export type ExternalIndicatorSeriesPoint = { fecha: string; valor: number };
export type ExternalIndicatorsSeriesData = {
  dolar: ExternalIndicatorSeriesPoint[] | null;
  uf: ExternalIndicatorSeriesPoint[] | null;
  ipc: ExternalIndicatorSeriesPoint[] | null;
  period: "weekly" | "monthly" | "yearly";
  updatedAt: string | null;
  source: string;
  error?: string;
};

export async function fetchExternalIndicatorsSeries(
  period: "weekly" | "monthly" | "yearly",
): Promise<ExternalIndicatorsSeriesData> {
  const res = await fetch(
    `${getApiBase()}/dashboard/external-indicators/series?period=${encodeURIComponent(period)}`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) {
    return {
      dolar: null,
      uf: null,
      ipc: null,
      period,
      updatedAt: null,
      source: "mindicador.cl (referencia Banco Central Chile)",
      error: "No disponible",
    };
  }
  return res.json();
}

function getEmptyExternalIndicators(error?: string): ExternalIndicatorsData {
  const empty: ExternalIndicatorItem = { value: null, fecha: null, unidad: null, error: true };
  return {
    dolar: { ...empty },
    uf: { ...empty },
    ipc: { ...empty },
    updatedAt: null,
    source: "mindicador.cl (referencia Banco Central Chile)",
    ...(error && { error }),
  };
}

// ——— Quotes ———
export type QuoteCurrentVersion = {
  id: string;
  versionNumber: number;
  status: string;
  total: number;
  createdAt: string;
  createdBy?: { id: string; name: string | null; email: string };
};
export type QuoteTemplateLine = {
  id: string;
  sortOrder: number;
  source: string;
  productId: string | null;
  productNameSnapshot: string | null;
  productDescriptionSnapshot: string | null;
  quantityRule: string;
  quantityFixed: number | null;
  potenciaPorPanelWp: number | null;
  unitPriceDefault: number;
  currency: string | null;
  visibleInFinalQuoteDefault: boolean;
  product?: { id: string; name: string; description: string | null } | null;
};
export type QuoteTemplateItem = {
  id: string;
  sortOrder: number;
  itemType: string;
  quantityRule: string;
  quantityFixed: number | null;
  potenciaPorPanelWp: number | null;
  productNameSnapshot: string;
  productDescriptionSnapshot: string | null;
  unitPriceDefault: number;
  /** Visibilidad por defecto del bloque al materializar cotización (PDF / cotización final). */
  visibleInFinalQuoteDefault: boolean;
  lines?: QuoteTemplateLine[];
};
export type QuoteTemplate = {
  id: string;
  name: string;
  /** STANDARD | MARGIN */
  quoteKind: string;
  systemType: string;
  targetPowerKwp: number;
  description: string | null;
  sortOrder: number;
  active?: boolean;
  items: QuoteTemplateItem[];
};
export type QuoteListItem = {
  id: string;
  clientId: string;
  ownerId: string;
  /** STANDARD | MARGIN (E1: siempre STANDARD salvo datos legacy sin campo). */
  quoteKind: string;
  /** Parámetros técnicos mínimos; la API devuelve objeto parseado (null si vacío). */
  technicalBasicsJson: Record<string, unknown> | null;
  sourceFvStudyId?: string | null;
  sourceFvStudy?: { id: string; title: string } | null;
  sourceQuoteTemplateId?: string | null;
  sourceQuoteTemplate?: { id: string; name: string } | null;
  suggestedItemsFromStudy?: boolean;
  status: string;
  title: string;
  projectType: string;
  /** Número correlativo comercial (ej. 2780-RES). */
  commercialNumber: string | null;
  commercialSequence: number | null;
  internalNotes: string | null;
  clientNotes: string | null;
  currency: string | null;
  validUntil: string | null;
  paymentTerms: string | null;
  deliveryDays: number | null;
  commercialStage: string | null;
  leadNumber: string | null;
  salespersonId: string | null;
  salesperson?: { id: string; name: string | null; fullName?: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
  /** En detalle suele venir el cliente completo; en listado al menos id, name (y a veces email). */
  client?: {
    id: string;
    name: string;
    type?: string;
    taxId?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  owner?: { id: string; name: string | null; fullName?: string | null; email: string };
  currentVersion: QuoteCurrentVersion | null;
};
export type QuoteDetail = QuoteListItem & {
  versions?: Array<{
    id: string;
    versionNumber: number;
    status: string;
    total: number;
    createdAt: string;
    createdBy?: { id: string; name: string | null; email: string };
  }>;
};
export type CreateQuoteInput = {
  clientId: string;
  title: string;
  projectType: string;
  /** Por defecto el API asume STANDARD. */
  quoteKind?: "STANDARD" | "MARGIN";
  internalNotes?: string;
  clientNotes?: string;
  currency?: string;
  validUntil?: string;
  paymentTerms?: string;
  deliveryDays?: number;
  commercialStage?: string;
  leadNumber?: string;
  salespersonId?: string;
  technicalBasicsJson?: Record<string, unknown>;
};
export type UpdateQuoteInput = {
  title?: string;
  projectType?: string;
  internalNotes?: string;
  clientNotes?: string;
  currency?: string;
  validUntil?: string;
  paymentTerms?: string;
  deliveryDays?: number;
  commercialStage?: string;
  status?: string;
  leadNumber?: string;
  salespersonId?: string;
  /** Vincular cotización a estudio FV (mismo cliente). `null` desvincula. */
  sourceFvStudyId?: string | null;
  /** Objeto JSON; `null` borra el valor en servidor. */
  technicalBasicsJson?: Record<string, unknown> | null;
};
export type FilterQuotesParams = {
  status?: string;
  clientId?: string;
  ownerId?: string;
  /** Listar cotizaciones vinculadas a un estudio FV (origen). */
  sourceFvStudyId?: string;
  search?: string;
  updatedAfter?: string;
  /** Alineado con API: incluye cotizaciones ANULADA y ARCHIVADA en el listado. */
  includeInactive?: boolean;
};

export async function fetchQuotes(filters?: FilterQuotesParams): Promise<QuoteListItem[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.clientId) params.set("clientId", filters.clientId);
  if (filters?.ownerId) params.set("ownerId", filters.ownerId);
  if (filters?.sourceFvStudyId) params.set("sourceFvStudyId", filters.sourceFvStudyId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.updatedAfter) params.set("updatedAfter", filters.updatedAfter);
  if (filters?.includeInactive === true) params.set("includeInactive", "true");
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/quotes${q}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar cotizaciones");
  return res.json();
}
export async function fetchQuote(id: string): Promise<QuoteDetail> {
  const res = await fetch(`${getApiBase()}/quotes/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Cotización no encontrada");
    throw new Error("Error al cargar cotización");
  }
  return res.json();
}
export async function createQuote(data: CreateQuoteInput): Promise<QuoteListItem> {
  const res = await fetch(`${getApiBase()}/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al crear cotización");
  }
  return res.json();
}
export async function updateQuote(id: string, data: UpdateQuoteInput): Promise<QuoteListItem> {
  const res = await fetch(`${getApiBase()}/quotes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al actualizar cotización");
  }
  return res.json();
}

// ——— Quote versions ———
export type QuoteVersionSummary = {
  id: string;
  versionNumber: number;
  status: string;
  subtotal: number;
  discountsTotal: number;
  marginTotal: number;
  taxesTotal: number;
  total: number;
  globalDiscountPercent: number | null;
  globalMarginPercent: number | null;
  vatPercent: number;
  createdAt: string;
  createdBy?: { id: string; name: string | null; email: string };
};
export type QuoteItemDto = {
  id: string;
  productId?: string | null;
  productNameSnapshot: string;
  productDescriptionSnapshot?: string | null;
  categoryNameSnapshot?: string | null;
  brandNameSnapshot?: string | null;
  modelNameSnapshot?: string | null;
  currencySnapshot: string;
  unitPriceSnapshot: number;
  unitCostSnapshot?: number | null;
  discountPercentSnapshot?: number | null;
  marginPercentSnapshot?: number | null;
  quantity: number;
  lineTotalSnapshot: number;
  sortOrder?: number | null;
  /** Solo quoteKind MARGIN */
  lineCostTotal?: number;
  lineUtility?: number;
  lineMarginPercent?: number | null;
};

/** Línea de detalle bajo un ítem principal (solo lectura en Fase 3). */
export type QuoteItemLineDto = {
  id: string;
  productId?: string | null;
  productNameSnapshot: string;
  productDescriptionSnapshot?: string | null;
  categoryNameSnapshot?: string | null;
  brandNameSnapshot?: string | null;
  modelNameSnapshot?: string | null;
  currencySnapshot: string;
  unitPriceSnapshot: number;
  unitCostSnapshot?: number | null;
  discountPercentSnapshot?: number | null;
  marginPercentSnapshot?: number | null;
  quantity: number;
  lineTotalSnapshot: number;
  sortOrder: number;
  visibleInFinalQuote: boolean;
  /** Solo quoteKind MARGIN */
  lineCostTotal?: number;
  lineUtility?: number;
  lineMarginPercent?: number | null;
};

/** Agregado económico del bloque (solo quoteKind MARGIN). */
export type QuoteMainItemMarginBlockEconomics = {
  blockCostTotal: number;
  blockSaleTotal: number;
  blockUtility: number;
  blockMarginPercent: number | null;
};

/** Ítem principal comercial (solo lectura en Fase 3). */
export type QuoteMainItemDto = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  visibleInFinalQuote: boolean;
  totalMode: string;
  totalOverride: number | null;
  total: number;
  lines: QuoteItemLineDto[];
  marginBlockEconomics?: QuoteMainItemMarginBlockEconomics | null;
};

/** Resumen FV (misma forma que FvSummaryFromStudy en constants). */
export type FvSnapshotSummary = {
  plantaKwp: number;
  cantidadPaneles: number;
  generacionAnualKwh: number;
  ahorroAnual: number;
  porcentajeAhorro: number;
  pagoResidualAnual: number;
  currency: string;
  sourceTitle?: string;
};

/** Snapshot FV congelado en versión (cuando status !== BORRADOR). */
export type FvSnapshotData = {
  summary: FvSnapshotSummary;
  months: FvStudyMonth[];
  studyForReport: FvStudy;
  implantationSummary: {
    placementCount: number;
    stringsSummary: Array<{ stringId: string; count: number }>;
    angles: number[];
    panelNameSnapshot: string | null;
    tiltDegrees: number | null;
    mountingType: string | null;
  };
};

/** Resumen costo/venta/utilidad (solo cotización MARGIN). */
export type QuoteMarginEconomicsSummary = {
  costTotal: number;
  saleSubtotal: number;
  saleNetBeforeTax: number;
  utilityTotal: number;
  marginPercentOnSaleNet: number | null;
};

export type QuoteVersionDetail = QuoteVersionSummary & {
  items: QuoteItemDto[];
  mainItems?: QuoteMainItemDto[];
  fvSnapshot?: string | null;
  marginEconomicsSummary?: QuoteMarginEconomicsSummary | null;
};
export type CreateVersionInput = { sourceVersionId?: string };
export type UpdateVersionInput = {
  status?: string;
  globalDiscountPercent?: number;
  globalMarginPercent?: number;
  vatPercent?: number;
};
export type CreateQuoteItemInput = {
  productId?: string;
  priceId?: string;
  unitPriceOverride?: number;
  discountPercent?: number;
  quantity: number;
  productNameSnapshot?: string;
  productDescriptionSnapshot?: string;
  categoryNameSnapshot?: string;
  brandNameSnapshot?: string;
  modelNameSnapshot?: string;
  currencySnapshot?: string;
  unitPriceSnapshot?: number;
};
export type UpdateQuoteItemInput = {
  quantity?: number;
  unitPriceOverride?: number;
  discountPercent?: number;
  /** Solo MARGIN */
  unitCostSnapshot?: number | null;
};

export async function fetchQuoteVersions(quoteId: string): Promise<QuoteVersionSummary[]> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar versiones");
  return res.json();
}
export async function fetchQuoteVersion(quoteId: string, versionId: string): Promise<QuoteVersionDetail> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Versión no encontrada");
    throw new Error("Error al cargar versión");
  }
  return res.json();
}
export async function createQuoteVersion(quoteId: string, body?: CreateVersionInput): Promise<QuoteVersionDetail> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al crear versión");
  }
  return res.json();
}
export async function updateQuoteVersion(quoteId: string, versionId: string, data: UpdateVersionInput): Promise<QuoteVersionDetail> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al actualizar versión");
  }
  return res.json();
}

/** Actualiza ítems técnicos base FV (paneles, inversor, estructura) desde el estudio vinculado. Solo cantidad y descripciones; no toca precios. */
export async function refreshQuoteVersionFromStudy(quoteId: string, versionId: string): Promise<QuoteVersionDetail> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/refresh-from-study`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al actualizar ítems desde estudio");
  }
  return res.json();
}

export async function addQuoteItem(quoteId: string, versionId: string, data: CreateQuoteItemInput): Promise<QuoteItemDto> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al agregar ítem");
  }
  return res.json();
}
export async function updateQuoteItem(quoteId: string, versionId: string, itemId: string, data: UpdateQuoteItemInput): Promise<QuoteItemDto> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al actualizar ítem");
  }
  return res.json();
}
export async function deleteQuoteItem(quoteId: string, versionId: string, itemId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/items/${itemId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al eliminar ítem");
}

// ——— Ítems principales y líneas (jerárquico) ———
export type CreateMainItemInput = {
  name: string;
  description?: string;
  totalMode: string;
  visibleInFinalQuote?: boolean;
  totalOverride?: number;
};

/** PATCH ítem madre / bloque (al menos un campo). */
export type UpdateMainItemInput = {
  name?: string;
  description?: string;
  visibleInFinalQuote?: boolean;
  totalMode?: string;
  totalOverride?: number | null;
};
export type CreateLineInput =
  | {
      source: "MANUAL";
      productNameSnapshot: string;
      productDescriptionSnapshot?: string;
      quantity: number;
      unitPriceSnapshot: number;
      discountPercentSnapshot?: number;
      currencySnapshot?: string;
      /** Solo cotización MARGIN; opcional. */
      unitCostSnapshot?: number | null;
    }
  | {
      source: "FROM_CATALOG";
      productId: string;
      quantity: number;
      priceId?: string;
      unitPriceOverride?: number;
    };
export type UpdateLineInput = {
  quantity?: number;
  unitPriceSnapshot?: number;
  discountPercentSnapshot?: number;
  productNameSnapshot?: string;
  productDescriptionSnapshot?: string;
  currencySnapshot?: string;
  visibleInFinalQuote?: boolean;
  /** Solo MARGIN */
  unitCostSnapshot?: number | null;
};

export async function createMainItem(
  quoteId: string,
  versionId: string,
  data: CreateMainItemInput,
): Promise<{ id: string; name: string }> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/main-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al crear ítem principal");
  }
  return res.json();
}

export async function updateMainItem(
  quoteId: string,
  versionId: string,
  mainItemId: string,
  data: UpdateMainItemInput,
): Promise<{ id: string; name: string }> {
  const res = await fetch(
    `${getApiBase()}/quotes/${quoteId}/versions/${versionId}/main-items/${mainItemId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al actualizar ítem principal");
  }
  return res.json();
}

export type ApplyCleanMarginHierarchyInput = {
  systemType: "ON_GRID" | "HYBRID" | "OFF_GRID";
  mountStructureType: "STANDARD" | "ANGULAR" | "MIXTA";
  replaceExisting?: boolean;
};

/** Plantilla limpia MARGIN: crea jerarquía desde constantes backend (solo MARGIN, versión BORRADOR). */
export async function applyCleanMarginHierarchy(
  quoteId: string,
  versionId: string,
  data: ApplyCleanMarginHierarchyInput,
): Promise<{ applied: boolean; blocksCreated: number }> {
  const res = await fetch(
    `${getApiBase()}/quotes/${quoteId}/versions/${versionId}/margin-hierarchy/apply-clean`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg = Array.isArray(err.message) ? err.message.join("; ") : err.message;
    throw new Error(msg ?? "Error al aplicar plantilla limpia MARGIN");
  }
  return res.json();
}

/** E2: plantilla MARGIN valorizada persistida (no QuoteTemplate). */
export type MarginTemplateSnapshotSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  systemType: string | null;
  mountStructureType: string | null;
  schemaVersion: string;
  sourceQuoteId: string | null;
  sourceQuoteVersionId: string | null;
};

/** Última del usuario (`active`, `createdAt` desc). `snapshot: null` si no hay. */
export async function fetchLatestMarginTemplateSnapshot(): Promise<{
  snapshot: MarginTemplateSnapshotSummary | null;
}> {
  const res = await fetch(`${getApiBase()}/margin-snapshots/latest`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al consultar plantillas valorizadas");
  return res.json();
}

export async function createMarginTemplateSnapshotFromVersion(
  quoteId: string,
  versionId: string,
  body: { name: string; description?: string },
): Promise<MarginTemplateSnapshotSummary> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/margin-snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(err.message) ? err.message.join("; ") : err.message;
    throw new Error(msg ?? "Error al guardar plantilla valorizada");
  }
  return res.json();
}

export async function applyLatestMarginTemplateSnapshotToVersion(
  quoteId: string,
  versionId: string,
  opts: { replaceExisting?: boolean },
): Promise<{ applied: boolean; snapshotId: string; blocksApplied: number }> {
  const res = await fetch(
    `${getApiBase()}/quotes/${quoteId}/versions/${versionId}/margin-snapshots/apply-latest`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(opts),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(err.message) ? err.message.join("; ") : err.message;
    throw new Error(msg ?? "Error al cargar la última plantilla valorizada");
  }
  return res.json();
}

/** Duplica ítem madre + todas sus líneas al final de la versión. */
export async function duplicateMainItem(
  quoteId: string,
  versionId: string,
  mainItemId: string,
): Promise<{ id: string }> {
  const res = await fetch(
    `${getApiBase()}/quotes/${quoteId}/versions/${versionId}/main-items/${mainItemId}/duplicate`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al duplicar bloque");
  }
  return res.json();
}

export async function createLine(
  quoteId: string,
  versionId: string,
  mainItemId: string,
  data: CreateLineInput,
): Promise<{ id: string }> {
  const res = await fetch(
    `${getApiBase()}/quotes/${quoteId}/versions/${versionId}/main-items/${mainItemId}/lines`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al agregar línea");
  }
  return res.json();
}
export async function updateLine(
  quoteId: string,
  versionId: string,
  lineId: string,
  data: UpdateLineInput,
): Promise<{ id: string }> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/lines/${lineId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al actualizar línea");
  }
  return res.json();
}
export async function deleteLine(quoteId: string, versionId: string, lineId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/lines/${lineId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al eliminar línea");
}

/** Duplica la línea al final del mismo bloque (ítem madre). */
export async function duplicateLine(
  quoteId: string,
  versionId: string,
  lineId: string,
): Promise<{ id: string }> {
  const res = await fetch(
    `${getApiBase()}/quotes/${quoteId}/versions/${versionId}/lines/${lineId}/duplicate`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al duplicar línea");
  }
  return res.json();
}

// ——— Validaciones técnicas (alertas de compatibilidad) ———
export type TechnicalValidationAlert = {
  code: string;
  message: string;
  severity: string;
  productId: string | null;
  itemId: string | null;
  lineId: string | null;
};

export async function fetchTechnicalValidations(
  quoteId: string,
  versionId: string,
): Promise<{ alerts: TechnicalValidationAlert[] }> {
  const res = await fetch(
    `${getApiBase()}/quotes/${quoteId}/versions/${versionId}/technical-validations`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) {
    if (res.status === 404) throw new Error("Versión no encontrada");
    throw new Error("Error al cargar validaciones técnicas");
  }
  return res.json();
}

// ——— Adicionales (reglas, inputs, sugerencias) ———
export type QuoteAddOnRule = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  conditionType: string;
  thresholdNumeric: number | null;
  inputKey: string;
  quantityRule: string;
  unit: string;
  unitPriceDefault: number | null;
  currency: string | null;
  applicationMode: string;
};
export type AddonInputDto = {
  inputKey: string;
  valueNumeric: number | null;
  valueText: string | null;
};
export type AddonInputsResponse = { inputs: AddonInputDto[] };
export type SetAddonInputsBody = { inputs: AddonInputDto[] };
export type AddonSuggestionItem = {
  id: string;
  quoteAddOnId: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  suggestedQuantity: number;
  suggestedUnitPrice: number;
  currency: string | null;
  status: string;
  quoteItemId: string | null;
};
export type AddonSuggestionsResponse = { suggestions: AddonSuggestionItem[] };

export async function fetchQuoteAddOns(): Promise<QuoteAddOnRule[]> {
  const res = await fetch(`${getApiBase()}/quote-addons`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar reglas de adicionales");
  return res.json();
}
export async function fetchAddonInputs(quoteId: string, versionId: string): Promise<AddonInputsResponse> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/addon-inputs`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar parámetros de adicionales");
  return res.json();
}
export async function setAddonInputs(quoteId: string, versionId: string, body: SetAddonInputsBody): Promise<AddonInputsResponse> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/addon-inputs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al guardar parámetros");
  }
  return res.json();
}
export async function fetchAddonSuggestions(quoteId: string, versionId: string): Promise<AddonSuggestionsResponse> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/addon-suggestions`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar sugerencias");
  return res.json();
}
export async function evaluateAddonSuggestions(quoteId: string, versionId: string): Promise<AddonSuggestionsResponse> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/versions/${versionId}/addon-suggestions/evaluate`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al evaluar adicionales");
  }
  return res.json();
}

export type AcceptAddonSuggestionResponse = { suggestionId: string; quoteItemId: string; status: "ACCEPTED" };
export type RejectAddonSuggestionResponse = { suggestionId: string; status: "REJECTED" };

export async function acceptAddonSuggestion(
  quoteId: string,
  versionId: string,
  suggestionId: string
): Promise<AcceptAddonSuggestionResponse> {
  const res = await fetch(
    `${getApiBase()}/quotes/${quoteId}/versions/${versionId}/addon-suggestions/${suggestionId}/accept`,
    { method: "POST", headers: getAuthHeaders() }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al aceptar sugerencia");
  }
  return res.json();
}

export async function rejectAddonSuggestion(
  quoteId: string,
  versionId: string,
  suggestionId: string
): Promise<RejectAddonSuggestionResponse> {
  const res = await fetch(
    `${getApiBase()}/quotes/${quoteId}/versions/${versionId}/addon-suggestions/${suggestionId}/reject`,
    { method: "POST", headers: getAuthHeaders() }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al rechazar sugerencia");
  }
  return res.json();
}

// ——— Cálculo FV ———
export type FvCalculationInput = {
  consumoMensualKwh: number;
  consumoAnualKwh?: number;
  cuentaMensual: number;
  valorKwhConsumo: number;
  valorKwhInyeccion: number;
  coberturaDeseada: number;
  tipoProyecto: string;
  potenciaObjetivoKwp?: number;
  potenciaPorPanelWp: number;
  currency?: string;
  quoteVersionId?: string;
};
export type QuoteFvCalculation = FvCalculationInput & {
  id: string;
  quoteId: string;
  quoteVersionId: string | null;
  hspDailyUsed: number;
  performanceRatioUsed: number;
  calculationMethodVersion: string;
  plantaKwp: number;
  cantidadPaneles: number;
  generacionAnualKwh: number;
  generacionMensualKwh: number;
  ahorroMensual: number;
  ahorroAnual: number;
  porcentajeAhorro: number;
  pagoResidual: number;
  createdAt: string;
  updatedAt: string;
};
export async function fetchFvCalculation(quoteId: string, versionId?: string | null): Promise<QuoteFvCalculation | null> {
  const url = versionId
    ? `${getApiBase()}/quotes/${quoteId}/fv-calculation?versionId=${encodeURIComponent(versionId)}`
    : `${getApiBase()}/quotes/${quoteId}/fv-calculation`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar cálculo FV");
  const data = await res.json();
  return data === null ? null : data;
}
export async function saveFvCalculation(quoteId: string, body: FvCalculationInput): Promise<QuoteFvCalculation> {
  const res = await fetch(`${getApiBase()}/quotes/${quoteId}/fv-calculation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al guardar cálculo FV");
  }
  return res.json();
}

// ——— Estudios FV ———
export type FvStudyMonth = {
  id: string;
  monthIndex: number;
  consumptionKwh: number;
  consumptionValue: number | null;
  generationKwh: number;
  generationValue: number | null;
  savingsPercent: number | null;
  estimatedPayment: number | null;
};

export type FvStudy = {
  id: string;
  clientId: string;
  ownerId: string | null;
  status: string;
  title: string;
  referenceMonth: number;
  referenceBillAmount: number | null;
  referenceConsumptionKwh: number | null;
  valorKwhConsumo: number;
  valorKwhInyeccion: number;
  currency: string;
  connectionType: string;
  tipoProyecto: string;
  /** ON_GRID | HYBRID | OFF_GRID */
  systemType: "ON_GRID" | "HYBRID" | "OFF_GRID";
  utilityGridAvailable?: boolean;
  gridExportEnabled?: boolean;
  /** Derivado en API; solo lectura */
  systemScenario?: string | null;
  potenciaSistemaKwp: number;
  potenciaPorPanelWp: number;
  coberturaDeseada: number;
  hspDailyUsed: number;
  performanceRatioUsed: number;
  calculationMethodVersion: string;
  cantidadPaneles: number;
  generacionAnualKwh: number;
  ahorroAnual: number;
  porcentajeAhorro: number;
  pagoResidualAnual: number;
  generationSource?: string;
  solarResourceProvider?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mountingType?: string | null;
  tiltDegrees?: number | null;
  azimuthDegrees?: number | null;
  solarResourceRequestedAt?: string | null;
  solarResourceMetadata?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string; email?: string | null; address?: string | null };
  owner?: { id: string; name: string | null; email: string } | null;
  months?: FvStudyMonth[];
};

export type CreateFvStudyInput = {
  clientId: string;
  title: string;
  referenceMonth: number;
  referenceBillAmount?: number;
  referenceConsumptionKwh?: number;
  valorKwhConsumo: number;
  valorKwhInyeccion: number;
  currency?: string;
  connectionType: string;
  tipoProyecto: string;
  systemType?: "ON_GRID" | "HYBRID" | "OFF_GRID";
  utilityGridAvailable: boolean;
  gridExportEnabled: boolean;
  potenciaSistemaKwp?: number;
  potenciaPorPanelWp: number;
  coberturaDeseada: number;
  hspDailyUsed?: number;
  performanceRatioUsed?: number;
  calculationMethodVersion?: string;
  generationSource?: string;
  solarResourceProvider?: string;
  latitude?: number;
  longitude?: number;
  mountingType?: string;
  tiltDegrees?: number;
  azimuthDegrees?: number;
  solarResourceRequestedAt?: string;
  solarResourceMetadata?: string;
  months: { monthIndex: number; consumptionKwh: number; generationKwh?: number }[];
};

export type UpdateFvStudyInput = {
  title?: string;
  referenceMonth?: number;
  referenceBillAmount?: number;
  referenceConsumptionKwh?: number;
  valorKwhConsumo?: number;
  valorKwhInyeccion?: number;
  currency?: string;
  connectionType?: string;
  tipoProyecto?: string;
  systemType?: "ON_GRID" | "HYBRID" | "OFF_GRID";
  utilityGridAvailable?: boolean;
  gridExportEnabled?: boolean;
  status?: string;
  potenciaSistemaKwp?: number;
  potenciaPorPanelWp?: number;
  coberturaDeseada?: number;
  hspDailyUsed?: number;
  performanceRatioUsed?: number;
  calculationMethodVersion?: string;
  generationSource?: string;
  solarResourceProvider?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mountingType?: string | null;
  tiltDegrees?: number | null;
  azimuthDegrees?: number | null;
  solarResourceRequestedAt?: string;
  solarResourceMetadata?: string;
  months?: { monthIndex: number; consumptionKwh: number; generationKwh?: number }[];
};

export async function fetchFvStudies(clientId?: string): Promise<FvStudy[]> {
  const url = clientId
    ? `${getApiBase()}/fv-studies?clientId=${encodeURIComponent(clientId)}`
    : `${getApiBase()}/fv-studies`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar estudios FV");
  return res.json();
}

export async function fetchFvStudy(id: string): Promise<FvStudy> {
  const res = await fetch(`${getApiBase()}/fv-studies/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Estudio FV no encontrado");
    throw new Error("Error al cargar estudio FV");
  }
  return res.json();
}

export async function fetchFvStudiesByClient(clientId: string): Promise<FvStudy[]> {
  const res = await fetch(`${getApiBase()}/clients/${clientId}/fv-studies`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar estudios FV del cliente");
  return res.json();
}

export async function createFvStudy(data: CreateFvStudyInput): Promise<FvStudy> {
  const res = await fetch(`${getApiBase()}/fv-studies`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al crear estudio FV");
  }
  return res.json();
}

export async function updateFvStudy(id: string, data: UpdateFvStudyInput): Promise<FvStudy> {
  const res = await fetch(`${getApiBase()}/fv-studies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al actualizar estudio FV");
  }
  return res.json();
}

export async function archiveFvStudy(id: string): Promise<FvStudy> {
  const res = await fetch(`${getApiBase()}/fv-studies/${id}/archive`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al archivar estudio FV"));
  }
  return res.json();
}

export async function deleteFvStudy(id: string): Promise<{ deleted: boolean }> {
  const res = await fetch(`${getApiBase()}/fv-studies/${id}`, { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al eliminar estudio FV"));
  }
  return res.json();
}

/** Contexto usado para estimación externa (Explorador Solar). */
export type SolarResourceExternalEstimateUsedContext = {
  latitude: number | null;
  longitude: number | null;
  panelCount: number | null;
  panelPowerWp: number | null;
  systemPowerKw: number | null;
  mountingType: string | null;
  tiltDegrees: number | null;
  azimuthDegrees: number | null;
};

/** Respuesta de POST /api/fv-studies/:id/solar-resource/external-estimate. */
export type SolarResourceExternalEstimateResponse = {
  provider: string;
  providerConfigured: boolean;
  requestReady: boolean;
  usedContext: SolarResourceExternalEstimateUsedContext;
  /** Fuente de datos de paneles: IMPLANTATION_DESIGN o FV_STUDY. */
  panelSource: "IMPLANTATION_DESIGN" | "FV_STUDY" | null;
  externalRequest: unknown | null;
  monthlyGeneration: Array<{ month: number; label: string; generationKwh: number }> | null;
  annualGenerationKwh: number | null;
  metadata: Record<string, unknown> | null;
  message: string | null;
};

function unwrapEstimatePayload(raw: unknown): Record<string, unknown> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const inner = o.data;
  if (inner != null && typeof inner === "object" && !Array.isArray(inner)) return inner as Record<string, unknown>;
  return o;
}

function parseEstimateMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p != null && typeof p === "object" && !Array.isArray(p)) return { ...(p as Record<string, unknown>) };
    } catch {
      return null;
    }
    return null;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return { ...(raw as Record<string, unknown>) };
  return null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Acepta camelCase o snake_case y payloads envueltos en `{ data }` (proxies / versiones viejas).
 * No inventa meses: si el backend envía `monthlyGeneration: null` (p. ej. `metadata.error`), sigue null.
 * Con ≥12 filas válidas, conserva la serie tal cual (hasta 12 primeras filas parseadas).
 */
export function normalizeSolarResourceExternalEstimateResponse(
  raw: unknown,
): SolarResourceExternalEstimateResponse {
  const r = unwrapEstimatePayload(raw);
  const meta = parseEstimateMetadata(r.metadata);
  if (meta && meta.providerUsed == null && meta.provider_used != null) {
    meta.providerUsed = meta.provider_used;
  }
  if (meta && meta.explorerSolarSkipped == null && meta.explorer_solar_skipped != null) {
    meta.explorerSolarSkipped = meta.explorer_solar_skipped;
  }
  if (meta && meta.pvwattsMonthlyDerivation == null && meta.pvwatts_monthly_derivation != null) {
    meta.pvwattsMonthlyDerivation = meta.pvwatts_monthly_derivation;
  }
  if (meta && meta.pvwattsFallbackBecauseMinenergiaFailed == null && meta.pvwatts_fallback_because_minenergia_failed != null) {
    meta.pvwattsFallbackBecauseMinenergiaFailed = meta.pvwatts_fallback_because_minenergia_failed;
  }
  if (meta && meta.pvwattsFailure == null && meta.pvwatts_failure != null) {
    meta.pvwattsFailure = meta.pvwatts_failure;
  }
  if (meta && meta.failedProvider == null && meta.failed_provider != null) {
    meta.failedProvider = meta.failed_provider;
  }
  if (meta && meta.estimateFailureReason == null && meta.estimate_failure_reason != null) {
    meta.estimateFailureReason = meta.estimate_failure_reason;
  }
  if (meta && meta.minenergiaFailure == null && meta.minenergia_failure != null) {
    meta.minenergiaFailure = meta.minenergia_failure;
  }

  let monthlyRaw: unknown = r.monthlyGeneration ?? r.monthly_generation;
  if (typeof monthlyRaw === "string" && monthlyRaw.trim() !== "") {
    try {
      monthlyRaw = JSON.parse(monthlyRaw) as unknown;
    } catch {
      monthlyRaw = null;
    }
  }
  let monthlyGeneration: SolarResourceExternalEstimateResponse["monthlyGeneration"] = null;
  if (Array.isArray(monthlyRaw)) {
    const rows: Array<{ month: number; label: string; generationKwh: number }> = [];
    for (let i = 0; i < monthlyRaw.length; i++) {
      const row = monthlyRaw[i];
      if (row == null || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      const gen =
        numOrNull(o.generationKwh)
        ?? numOrNull(o.generation_kwh)
        ?? numOrNull(o.generationKWh)
        ?? numOrNull(o.value)
        ?? numOrNull(o.kwh);
      if (gen == null) continue;
      const m = numOrNull(o.month);
      const label = typeof o.label === "string" ? o.label : String(i + 1);
      rows.push({
        month: m != null && m >= 1 && m <= 12 ? Math.floor(m) : i + 1,
        label,
        generationKwh: gen,
      });
    }
    if (rows.length >= 12) monthlyGeneration = rows.slice(0, 12);
  }

  let annualGenerationKwh = numOrNull(r.annualGenerationKwh ?? r.annual_generation_kwh);
  if (annualGenerationKwh == null && monthlyGeneration && monthlyGeneration.length === 12) {
    annualGenerationKwh = monthlyGeneration.reduce((s, m) => s + m.generationKwh, 0);
  }

  const ucRaw = r.usedContext ?? r.used_context;
  let usedContext: SolarResourceExternalEstimateUsedContext = {
    latitude: null,
    longitude: null,
    panelCount: null,
    panelPowerWp: null,
    systemPowerKw: null,
    mountingType: null,
    tiltDegrees: null,
    azimuthDegrees: null,
  };
  if (ucRaw != null && typeof ucRaw === "object" && !Array.isArray(ucRaw)) {
    const u = ucRaw as Record<string, unknown>;
    usedContext = {
      latitude: numOrNull(u.latitude),
      longitude: numOrNull(u.longitude),
      panelCount: numOrNull(u.panelCount ?? u.panel_count) as number | null,
      panelPowerWp: numOrNull(u.panelPowerWp ?? u.panel_power_wp),
      systemPowerKw: numOrNull(u.systemPowerKw ?? u.system_power_kw),
      mountingType: typeof u.mountingType === "string" ? u.mountingType : typeof u.mounting_type === "string" ? u.mounting_type : null,
      tiltDegrees: numOrNull(u.tiltDegrees ?? u.tilt_degrees),
      azimuthDegrees: numOrNull(u.azimuthDegrees ?? u.azimuth_degrees),
    };
  }

  const panelSourceRaw = r.panelSource ?? r.panel_source;
  const panelSource =
    panelSourceRaw === "IMPLANTATION_DESIGN" || panelSourceRaw === "FV_STUDY" ? panelSourceRaw : null;

  const provider =
    typeof r.provider === "string" && r.provider !== ""
      ? r.provider
      : meta?.error === true
        ? "ESTIMATE_FAILED"
        : "EXPLORADOR_SOLAR";

  return {
    provider,
    providerConfigured: Boolean(r.providerConfigured ?? r.provider_configured),
    requestReady: Boolean(r.requestReady ?? r.request_ready),
    usedContext,
    panelSource,
    externalRequest: r.externalRequest ?? r.external_request ?? null,
    monthlyGeneration,
    annualGenerationKwh,
    metadata: meta,
    message: r.message != null && typeof r.message === "string" ? r.message : r.message != null ? String(r.message) : null,
  };
}

function truncateForLog(s: string, max = 12000): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated ${s.length - max} chars]`;
}

/** Flags compactos para depurar estimación solar (consola). */
export function getSolarEstimateTraceFlags(n: SolarResourceExternalEstimateResponse) {
  const meta = n.metadata;
  const pvf = meta && typeof meta.pvwattsFailure === "object" && meta.pvwattsFailure != null ? meta.pvwattsFailure as { code?: string } : null;
  return {
    provider: n.provider,
    providerUsed: meta && typeof meta.providerUsed === "string" ? meta.providerUsed : null,
    annualGenerationKwh: n.annualGenerationKwh,
    monthlyCount: n.monthlyGeneration?.length ?? 0,
    hasError: meta?.error === true,
    estimateFailureReason:
      meta && typeof meta.estimateFailureReason === "string" ? meta.estimateFailureReason : null,
    pvwattsFailureCode: pvf?.code ?? null,
    failedProvider: meta && typeof meta.failedProvider === "string" ? meta.failedProvider : null,
  };
}

/** Consulta contexto/estimación externa (Explorador Solar). Requiere estudio guardado. La URL debe apuntar al backend (ej. http://localhost:4000/api). */
export async function requestSolarResourceExternalEstimate(
  studyId: string,
): Promise<SolarResourceExternalEstimateResponse> {
  const base = getApiBase();
  const url = `${base.replace(/\/$/, "")}/fv-studies/${studyId}/solar-resource/external-estimate`;
  if (typeof window !== "undefined") {
    console.log("[SOLAR-DEBUG] apiBase =", JSON.stringify(base));
    console.log("[SOLAR-DEBUG] requestUrl =", url);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const text = await res.text();
  const data = (() => {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { message: text || `HTTP ${res.status}` };
    }
  })();
  if (typeof window !== "undefined") {
    console.log("[SOLAR-FRONTEND] raw response =", truncateForLog(JSON.stringify(data)));
  }
  if (!res.ok) {
    const msg = (data as { message?: string | string[] }).message;
    const flat = Array.isArray(msg) ? msg.join("; ") : msg;
    if (typeof window !== "undefined") {
      console.log("[SOLAR-FRONTEND] HTTP error body =", truncateForLog(JSON.stringify(data)), "status =", res.status);
    }
    throw new Error(flat ?? `Error al consultar estimación externa (HTTP ${res.status})`);
  }
  const normalized = normalizeSolarResourceExternalEstimateResponse(data);
  if (typeof window !== "undefined") {
    console.log("[SOLAR-FRONTEND] normalized response =", truncateForLog(JSON.stringify(normalized)));
    console.log("[SOLAR-FRONTEND] render flags =", getSolarEstimateTraceFlags(normalized));
  }
  return normalized;
}

// ——— Diseño de implantación ———
export type ImplantationPlacement = {
  id: string;
  implantationDesignId: string;
  positionIndex: number;
  originLat: number;
  originLng: number;
  orientationDeg: number | null;
  stringId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImplantationDesign = {
  id: string;
  fvStudyId: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  roofPolygonGeoJson: string | null;
  panelProductId: string | null;
  panelNameSnapshot: string | null;
  panelPowerWSnapshot: number | null;
  panelWidthMmSnapshot: number | null;
  panelLengthMmSnapshot: number | null;
  panelOrientationMode: string | null;
  spacingHorizontalMm: number | null;
  spacingVerticalMm: number | null;
  screenshotUrl: string | null;
  placements: ImplantationPlacement[];
  createdAt: string;
  updatedAt: string;
};

export async function fetchImplantationDesign(fvStudyId: string): Promise<ImplantationDesign | null> {
  const res = await fetch(`${getApiBase()}/fv-studies/${fvStudyId}/implantation-design`, { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Error al cargar diseño de implantación");
  }
  const text = await res.text();
  if (!text || text.trim() === "") return null;
  try {
    const data = JSON.parse(text);
    return data === null ? null : data;
  } catch {
    return null;
  }
}

/** Elimina por completo el diseño de implantación del estudio (polígono, placements, captura). */
export async function deleteImplantationDesign(fvStudyId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/fv-studies/${fvStudyId}/implantation-design`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = (() => {
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        return { message: text || `HTTP ${res.status}` };
      }
    })();
    const msg = err.message ?? "Error al eliminar diseño de implantación";
    throw new Error(`${msg} [${res.status}]`);
  }
}

export type UpsertImplantationDesignPlacement = {
  positionIndex: number;
  originLat: number;
  originLng: number;
  orientationDeg?: number;
  stringId?: string | null;
};

export type UpsertImplantationDesignInput = {
  centerLat: number;
  centerLng: number;
  zoom: number;
  roofPolygonGeoJson?: string | null;
  panelProductId?: string | null;
  panelNameSnapshot?: string | null;
  panelPowerWSnapshot?: number | null;
  panelWidthMmSnapshot?: number | null;
  panelLengthMmSnapshot?: number | null;
  panelOrientationMode?: "VERTICAL" | "HORIZONTAL" | null;
  spacingHorizontalMm?: number | null;
  spacingVerticalMm?: number | null;
  placements: UpsertImplantationDesignPlacement[];
};

export async function upsertImplantationDesign(
  fvStudyId: string,
  data: UpsertImplantationDesignInput,
): Promise<ImplantationDesign> {
  const res = await fetch(`${getApiBase()}/fv-studies/${fvStudyId}/implantation-design`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al guardar diseño de implantación");
  }
  return res.json();
}


/** GET /api/health → { ok: true }. Comprueba que el backend Nest está vivo y que el frontend lo alcanza. */
export function healthUrl(): string {
  return `${getApiBase()}/health`;
}

/** Respuesta de GET /api/lan/discovery (MVP conectividad + descubrimiento LAN). */
export type LanDiscoveryResponse = {
  enabled: boolean;
  error?: string;
  multicastGroup: string;
  udpPort: number;
  instanceId: string;
  apiPort: number;
  hostname: string;
  internetReachable: boolean | null;
  internetCheckedAtMs: number | null;
  peers: Array<{
    address: string;
    apiPort: number;
    hostname: string;
    instanceId: string;
    lastSeenAgeMs: number;
  }>;
  peerCount: number;
};

export function lanDiscoveryUrl(): string {
  return `${getApiBase()}/lan/discovery`;
}

/** Estado LAN/internet desde el servidor (sin JWT; allowlist). Falla si no hay backend. */
export async function fetchLanDiscovery(signal?: AbortSignal): Promise<LanDiscoveryResponse> {
  const res = await fetch(lanDiscoveryUrl(), { signal, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Estado de red"));
  }
  return res.json() as Promise<LanDiscoveryResponse>;
}

/** GET /api/implantation-screenshots/ping → { ok: true }. Comprueba que el módulo de captura está cargado. */
export function screenshotPingUrl(): string {
  return `${getApiBase()}/implantation-screenshots/ping`;
}

/** URL del endpoint de captura (GET imagen). Ruta: /api/implantation-screenshots/:fvStudyId */
export function implantationScreenshotUrl(fvStudyId: string): string {
  return `${getApiBase()}/implantation-screenshots/${fvStudyId}`;
}

/** Obtiene la imagen de la captura del diseño (con auth). Devuelve null si no hay captura o error. */
export async function fetchImplantationScreenshotBlob(fvStudyId: string): Promise<Blob | null> {
  const res = await fetch(implantationScreenshotUrl(fvStudyId), { headers: getAuthHeaders() });
  if (!res.ok) return null;
  return res.blob();
}

/** Sube la captura del diseño. POST /api/fv-studies/:fvStudyId/implantation-design/screenshot (mismo controller que PUT diseño; auth idéntico). Campo del archivo: "file". */
export async function uploadImplantationScreenshot(
  fvStudyId: string,
  file: File | Blob,
  filename = "capture.png",
): Promise<ImplantationDesign> {
  const form = new FormData();
  form.append("file", file instanceof File ? file : new File([file], filename, { type: "image/png" }));
  const res = await fetch(`${getApiBase()}/fv-studies/${fvStudyId}/implantation-design/screenshot`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    const err = (() => {
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        return { message: text || `HTTP ${res.status}` };
      }
    })();
    const msg = err.message ?? "Error al guardar la captura";
    throw new Error(`${msg} [${res.status}]`);
  }
  return res.json();
}

export type CreateQuoteFromFvStudyResult = {
  quote: QuoteListItem & { sourceFvStudy?: { id: string; title: string } | null };
  version: { id: string; versionNumber: number; status: string };
};

export async function fetchQuoteTemplates(quoteKind?: "STANDARD" | "MARGIN"): Promise<QuoteTemplate[]> {
  const q =
    quoteKind != null ? `?quoteKind=${encodeURIComponent(quoteKind)}` : "";
  const res = await fetch(`${getApiBase()}/quote-templates${q}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Error al cargar plantillas");
  return res.json();
}

export async function fetchQuoteTemplate(id: string): Promise<QuoteTemplate> {
  const res = await fetch(`${getApiBase()}/quote-templates/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Plantilla no encontrada");
    throw new Error("Error al cargar plantilla");
  }
  return res.json();
}

export type CreateQuoteTemplateInput = {
  name: string;
  quoteKind?: "STANDARD" | "MARGIN";
  systemType: "ON_GRID" | "OFF_GRID" | "HYBRID";
  targetPowerKwp?: number;
  description?: string;
};

export async function createQuoteTemplate(data: CreateQuoteTemplateInput): Promise<QuoteTemplate> {
  const res = await fetch(`${getApiBase()}/quote-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al crear plantilla");
  }
  return res.json();
}

export type UpdateQuoteTemplateInput = {
  name?: string;
  systemType?: "ON_GRID" | "OFF_GRID" | "HYBRID";
  targetPowerKwp?: number;
  description?: string;
  active?: boolean;
};

export async function updateQuoteTemplate(id: string, data: UpdateQuoteTemplateInput): Promise<QuoteTemplate> {
  const res = await fetch(`${getApiBase()}/quote-templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al actualizar plantilla"));
  }
  return res.json();
}

export async function createTemplateItem(
  templateId: string,
  body: { productNameSnapshot: string; itemType?: string },
): Promise<QuoteTemplate> {
  const res = await fetch(`${getApiBase()}/quote-templates/${encodeURIComponent(templateId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al crear bloque"));
  }
  return res.json();
}

export async function deleteTemplateItem(templateId: string, itemId: string): Promise<QuoteTemplate> {
  const res = await fetch(
    `${getApiBase()}/quote-templates/${encodeURIComponent(templateId)}/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE", headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al eliminar bloque"));
  }
  return res.json();
}

export type CreateTemplateFromQuoteVersionInput = {
  quoteId: string;
  versionId: string;
  name: string;
  systemType?: "ON_GRID" | "OFF_GRID" | "HYBRID";
  targetPowerKwp?: number;
};

export async function createTemplateFromQuoteVersion(
  body: CreateTemplateFromQuoteVersionInput,
): Promise<QuoteTemplate> {
  const res = await fetch(`${getApiBase()}/quote-templates/from-quote-version`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al crear plantilla desde cotización"));
  }
  return res.json();
}

export type CreateTemplateLineInput = {
  source: "MANUAL" | "FROM_CATALOG";
  productId?: string;
  productNameSnapshot?: string;
  productDescriptionSnapshot?: string;
  quantityRule: "FIXED" | "DERIVED_FROM_POWER";
  quantityFixed?: number;
  potenciaPorPanelWp?: number;
  unitPriceDefault?: number;
  currency?: string;
  visibleInFinalQuoteDefault?: boolean;
};

export async function createTemplateLine(
  templateId: string,
  itemId: string,
  body: CreateTemplateLineInput
): Promise<QuoteTemplateLine> {
  const res = await fetch(`${getApiBase()}/quote-templates/${templateId}/items/${itemId}/lines`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al crear línea");
  }
  return res.json();
}

export type UpdateTemplateLineInput = {
  productNameSnapshot?: string;
  productDescriptionSnapshot?: string;
  quantityRule?: "FIXED" | "DERIVED_FROM_POWER";
  quantityFixed?: number;
  potenciaPorPanelWp?: number;
  unitPriceDefault?: number;
  currency?: string;
  visibleInFinalQuoteDefault?: boolean;
};

export type UpdateTemplateItemInput = {
  productNameSnapshot?: string;
  productDescriptionSnapshot?: string | null;
  visibleInFinalQuoteDefault?: boolean;
};

export async function updateTemplateItem(
  templateId: string,
  itemId: string,
  body: UpdateTemplateItemInput
): Promise<QuoteTemplate> {
  const res = await fetch(`${getApiBase()}/quote-templates/${templateId}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al actualizar bloque");
  }
  return res.json();
}

export async function updateTemplateLine(
  templateId: string,
  lineId: string,
  body: UpdateTemplateLineInput
): Promise<QuoteTemplateLine> {
  const res = await fetch(`${getApiBase()}/quote-templates/${templateId}/lines/${lineId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al actualizar línea");
  }
  return res.json();
}

export async function deleteTemplateLine(templateId: string, lineId: string): Promise<{ deleted: boolean }> {
  const res = await fetch(`${getApiBase()}/quote-templates/${templateId}/lines/${lineId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al eliminar línea");
  }
  return res.json();
}

export type CreateQuoteFromTemplateResult = {
  quote: QuoteListItem;
  version: { id: string; versionNumber: number; status: string };
};

export async function createQuoteFromTemplate(
  templateId: string,
  body: { clientId: string; currency?: string; title?: string; fvStudyId?: string }
): Promise<CreateQuoteFromTemplateResult> {
  const res = await fetch(`${getApiBase()}/quote-templates/${templateId}/create-quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al crear cotización desde plantilla");
  }
  return res.json();
}

export async function createQuoteFromFvStudy(
  studyId: string,
  options: { createWithSuggestedItems?: boolean; quoteKind?: "STANDARD" | "MARGIN" } = {},
): Promise<CreateQuoteFromFvStudyResult> {
  const { createWithSuggestedItems = true, quoteKind = "STANDARD" } = options;
  const res = await fetch(`${getApiBase()}/fv-studies/${studyId}/create-quote`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ createWithSuggestedItems, quoteKind }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "Error al crear cotización desde estudio");
  }
  return res.json();
}

// ——— Perfil empresa (singleton; solo ADMIN / ADMIN_DEV en backend) ———

export type CompanyProfile = {
  id: string;
  hasLogo: boolean;
  logoMimeType: string | null;
  commercialName: string | null;
  legalName: string | null;
  taxId: string | null;
  businessActivity: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  bankName: string | null;
  accountType: string | null;
  accountNumber: string | null;
  accountHolderName: string | null;
  accountHolderTaxId: string | null;
  transferReceiptEmail: string | null;
  generalNotes: string | null;
  quoteNote: string | null;
  paymentTerms: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UpdateCompanyProfileInput = Partial<{
  commercialName: string | null;
  legalName: string | null;
  taxId: string | null;
  businessActivity: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  bankName: string | null;
  accountType: string | null;
  accountNumber: string | null;
  accountHolderName: string | null;
  accountHolderTaxId: string | null;
  transferReceiptEmail: string | null;
  generalNotes: string | null;
  quoteNote: string | null;
  paymentTerms: string | null;
}>;

export async function fetchCompanyProfile(): Promise<CompanyProfile> {
  const res = await fetch(`${getApiBase()}/company-profile`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al cargar datos de empresa");
  }
  return res.json();
}

export async function patchCompanyProfile(body: UpdateCompanyProfileInput): Promise<CompanyProfile> {
  const res = await fetch(`${getApiBase()}/company-profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al guardar datos de empresa");
  }
  return res.json();
}

export async function uploadCompanyLogo(file: File): Promise<CompanyProfile> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${getApiBase()}/company-profile/logo`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al subir logo");
  }
  return res.json();
}

export async function deleteCompanyLogo(): Promise<CompanyProfile> {
  const res = await fetch(`${getApiBase()}/company-profile/logo`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al quitar logo");
  }
  return res.json();
}

/** Blob del logo (GET autenticado). Devuelve null si no hay logo (404). */
export async function fetchCompanyLogoBlob(): Promise<Blob | null> {
  const res = await fetch(`${getApiBase()}/company-profile/logo`, {
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al cargar logo");
  }
  return res.blob();
}

/** Perfil de empresa para vista previa / impresión (roles con acceso a cotizaciones; no es el endpoint administrativo). */
export async function fetchCompanyProfileForDocument(): Promise<CompanyProfile> {
  const res = await fetch(`${getApiBase()}/quotes/document/company-profile`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al cargar datos de empresa para el documento");
  }
  return res.json();
}

/** Logo para documento de cotización (GET autenticado, misma política que `fetchCompanyProfileForDocument`). */
export async function fetchCompanyLogoForDocumentBlob(): Promise<Blob | null> {
  const res = await fetch(`${getApiBase()}/quotes/document/company-profile/logo`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al cargar logo para el documento");
  }
  return res.blob();
}

/** Branding sin sesión (login): solo indica si hay logo en Datos de empresa. */
export async function fetchPublicBrandingHasLogo(): Promise<boolean> {
  const res = await fetch(`${getApiBase()}/public/branding/company-profile`, {
    cache: "no-store",
  });
  if (!res.ok) return false;
  const j = (await res.json().catch(() => ({}))) as { hasLogo?: boolean };
  return j.hasLogo === true;
}

/** Logo público para pantalla de login (mismo archivo que Datos de empresa). Sin token. */
export async function fetchPublicBrandingLogoBlob(): Promise<Blob | null> {
  const res = await fetch(`${getApiBase()}/public/branding/company-logo`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.blob();
}

// ——— Conversaciones (V1-A) ———

export type ConversationListItemDto = {
  id: string;
  type: string;
  title: string;
  rawTitle: string | null;
  updatedAt: string;
  unreadCount: number;
  /** Solo DIRECT: id del otro participante (para presencia en bandeja). Null en grupos. */
  directPeerUserId: string | null;
  /** Solo DIRECT: presencia del otro participante en este instante. */
  present: boolean | null;
  presenceStatus: "online" | "offline" | null;
  /** Solo DIRECT/OFFLINE: último visto. */
  lastSeenAt: string | null;
  /** Archivo suave por miembro: fecha ISO si usted archivó el hilo; null si está activo en su bandeja. */
  archivedAtForMe: string | null;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    authorId: string;
    authorName: string;
  } | null;
};

export type ConversationDetailDto = {
  id: string;
  type: string;
  title: string;
  rawTitle: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  /** True si usted archivó esta conversación (sigue pudiendo abrirla y participar). */
  archivedForMe: boolean;
  members: {
    userId: string;
    joinedAt: string;
    lastReadAt: string | null;
    archivedAt: string | null;
    user: { id: string; email: string; name: string };
  }[];
};

/** Ref. a cotización guardada en metadata del mensaje (incluye snapshot para UI). */
export type MessageQuoteRefDto = {
  quoteId: string;
  titleSnapshot: string;
  commercialNumberSnapshot: string | null;
};

/** Metadata enriquecida que devuelve la API en listados de mensajes. */
export type MessageMetadataDto = {
  mentions: { userId: string; displayName: string }[];
  quoteRefs: MessageQuoteRefDto[];
  replyTo: {
    messageId: string;
    authorNameSnapshot: string;
    bodySnippet: string;
  } | null;
};

export type ConversationMessageDto = {
  id: string;
  body: string;
  kind: "TEXT" | "SHARED_ENTITY" | "FILE";
  createdAt: string;
  authorId: string;
  authorName: string;
  metadata: MessageMetadataDto | null;
  sharedEntity: {
    entityType:
      | "PRODUCT"
      | "SUPPLIER"
      | "CLIENT"
      | "FV_STUDY"
      | "QUOTE"
      | "QUOTE_TEMPLATE";
    sourceUserId: string;
    sourceUserName: string;
    sourceNodeName: string;
    sourceEntityId: string | null;
    snapshot: Record<string, unknown>;
    myStatus: "PENDING" | "INTEGRATED" | "REJECTED" | "ERROR" | null;
    myResolutionMode: "CREATE_NEW" | "USE_EXISTING" | "LINK_EXISTING" | "REJECT" | null;
    myTargetEntityId: string | null;
    myErrorMessage: string | null;
  } | null;
  reactions: Array<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string;
  }>;
};

function normalizeMessageMetadata(raw: unknown): MessageMetadataDto | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const replyToRaw = o.replyTo;
  const replyTo =
    replyToRaw && typeof replyToRaw === "object"
      ? {
          messageId: String((replyToRaw as Record<string, unknown>).messageId ?? ""),
          authorNameSnapshot: String((replyToRaw as Record<string, unknown>).authorNameSnapshot ?? ""),
          bodySnippet: String((replyToRaw as Record<string, unknown>).bodySnippet ?? ""),
        }
      : null;
  return {
    mentions: Array.isArray(o.mentions)
      ? o.mentions
          .filter((m): m is { userId: string; displayName: string } => !!m && typeof m === "object")
          .map((m) => ({
            userId: String((m as { userId?: string }).userId ?? ""),
            displayName: String((m as { displayName?: string }).displayName ?? ""),
          }))
      : [],
    quoteRefs: Array.isArray(o.quoteRefs)
      ? o.quoteRefs
          .filter((q): q is MessageQuoteRefDto => !!q && typeof q === "object")
          .map((q) => ({
            quoteId: String((q as { quoteId?: string }).quoteId ?? ""),
            titleSnapshot: String((q as { titleSnapshot?: string }).titleSnapshot ?? ""),
            commercialNumberSnapshot: ((q as { commercialNumberSnapshot?: unknown }).commercialNumberSnapshot ??
              null) as string | null,
          }))
      : [],
    replyTo:
      replyTo && replyTo.messageId
        ? replyTo
        : null,
  };
}

function normalizeConversationMessage(raw: unknown): ConversationMessageDto {
  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(m.id ?? ""),
    body: String(m.body ?? ""),
    kind: (m.kind === "SHARED_ENTITY" || m.kind === "FILE" ? m.kind : "TEXT") as ConversationMessageDto["kind"],
    createdAt: String(m.createdAt ?? new Date().toISOString()),
    authorId: String(m.authorId ?? ""),
    authorName: String(m.authorName ?? "Usuario"),
    metadata: normalizeMessageMetadata(m.metadata),
    sharedEntity:
      m.sharedEntity && typeof m.sharedEntity === "object"
        ? (m.sharedEntity as ConversationMessageDto["sharedEntity"])
        : null,
    reactions: Array.isArray(m.reactions)
      ? (m.reactions as ConversationMessageDto["reactions"])
      : [],
    attachments: Array.isArray(m.attachments)
      ? (m.attachments as ConversationMessageDto["attachments"])
      : [],
  };
}

function normalizeConversationMessagesResponse(raw: unknown): { messages: ConversationMessageDto[] } {
  const obj = (raw ?? {}) as { messages?: unknown };
  return {
    messages: Array.isArray(obj.messages) ? obj.messages.map(normalizeConversationMessage) : [],
  };
}

export async function fetchConversationsDirectoryUsers(opts?: {
  presentOnly?: boolean;
}): Promise<{
  users: {
    id: string;
    email: string;
    name: string;
    present: boolean;
    presenceStatus?: "online" | "offline";
    lastSeenAt?: string | null;
  }[];
}> {
  const base = getLocalConversationsApiBase();
  const q = opts?.presentOnly === true ? "?presentOnly=true" : "";
  const res = await fetch(`${base}/conversations/directory-users${q}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al cargar usuarios");
  }
  const data = (await res.json()) as {
    users: {
      id: string;
      email: string;
      name: string;
      present: boolean;
      presenceStatus?: "online" | "offline";
      lastSeenAt?: string | null;
    }[];
  };
  if (typeof window !== "undefined") {
    try {
      if (
        process.env.NODE_ENV === "development" ||
        window.localStorage.getItem("PV_CONV_DIRECTORY_LOG") === "1"
      ) {
        // eslint-disable-next-line no-console
        console.warn("[PV_CONV_DIRECTORY]", {
          apiBase: base,
          rowCount: data.users?.length,
          emails: data.users?.map((u) => u.email),
          userIds: data.users?.map((u) => u.id),
          headers: {
            rows: res.headers.get("X-PV-Directory-Row-Count"),
            lanInstance: res.headers.get("X-PV-Lan-Instance-Id"),
            peerCount: res.headers.get("X-PV-Lan-Peer-Count"),
            mesh: res.headers.get("X-PV-Mesh-Configured"),
          },
          names: data.users?.map((u) => u.name),
          present: data.users?.filter((u) => u.present).map((u) => u.name),
        });
      }
    } catch {
      /* no-op */
    }
  }
  return data;
}

export async function fetchConversationsList(opts?: {
  /** Incluye hilos que usted archivó (además de los activos). Por defecto solo activos. */
  includeArchived?: boolean;
}): Promise<{
  conversations: ConversationListItemDto[];
}> {
  const q =
    opts?.includeArchived === true ? "?includeArchived=true" : "";
  const res = await fetch(`${getLocalConversationsApiBase()}/conversations${q}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al listar conversaciones");
  }
  return res.json();
}

export async function patchConversationArchiveForMe(
  conversationId: string,
  archive: boolean,
): Promise<{ ok: true; archivedAt?: string }> {
  const path = archive ? "archive" : "unarchive";
  const res = await fetch(
    `${getLocalConversationsApiBase()}/conversations/${encodeURIComponent(conversationId)}/${path}`,
    { method: "PATCH", headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al actualizar archivo de conversación");
  }
  return res.json();
}

export async function fetchConversationDetail(
  id: string,
): Promise<ConversationDetailDto> {
  const res = await fetch(`${getLocalConversationsApiBase()}/conversations/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al cargar conversación");
  }
  return res.json();
}

export async function fetchConversationMessages(
  conversationId: string,
  opts?: { limit?: number; before?: string },
): Promise<{ messages: ConversationMessageDto[] }> {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.before) q.set("before", opts.before);
  const qs = q.toString();
  const res = await fetch(
    `${getLocalConversationsApiBase()}/conversations/${encodeURIComponent(conversationId)}/messages${qs ? `?${qs}` : ""}`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al cargar mensajes");
  }
  return normalizeConversationMessagesResponse(await res.json());
}

export async function createConversationApi(body: {
  type: "DIRECT" | "GROUP";
  title?: string;
  memberUserIds: string[];
}): Promise<ConversationDetailDto> {
  const res = await fetch(`${getLocalConversationsApiBase()}/conversations`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string | string[] }).message?.toString() ??
        "Error al crear conversación",
    );
  }
  return res.json();
}

export type PostConversationMessageInput = {
  body?: string;
  mentions?: string[];
  quoteIds?: string[];
  replyToMessageId?: string;
  sharedEntity?: {
    entityType: "PRODUCT" | "SUPPLIER" | "CLIENT" | "FV_STUDY" | "QUOTE" | "QUOTE_TEMPLATE";
    snapshot: Record<string, unknown>;
    proposedImport: Record<string, unknown>;
    sourceEntityId?: string;
  };
};

export type PostConversationMessageResponse = {
  id: string;
  body: string;
  kind: "TEXT" | "SHARED_ENTITY";
  createdAt: string;
  authorId: string;
  authorName: string;
  metadata: MessageMetadataDto | null;
  sharedEntity: ConversationMessageDto["sharedEntity"];
  reactions: ConversationMessageDto["reactions"];
  attachments: ConversationMessageDto["attachments"];
};

export async function postConversationMessage(
  conversationId: string,
  payload: string | PostConversationMessageInput,
): Promise<PostConversationMessageResponse> {
  const bodyObj =
    typeof payload === "string"
      ? { body: payload }
      : {
          ...(payload.body != null ? { body: payload.body } : {}),
          ...(payload.mentions?.length ? { mentions: payload.mentions } : {}),
          ...(payload.quoteIds?.length ? { quoteIds: payload.quoteIds } : {}),
          ...(payload.replyToMessageId ? { replyToMessageId: payload.replyToMessageId } : {}),
          ...(payload.sharedEntity ? { sharedEntity: payload.sharedEntity } : {}),
        };
  const res = await fetch(
    `${getLocalConversationsApiBase()}/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string | string[] }).message;
    const text = Array.isArray(msg) ? msg.join(", ") : (msg ?? "Error al enviar mensaje");
    throw new Error(text);
  }
  const json = normalizeConversationMessage(await res.json()) as PostConversationMessageResponse;
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.warn("[PV_CONV_MESSAGE_SEND]", {
      conversationId,
      messageId: json.id,
      authorId: json.authorId,
      conversationsNest: getLocalConversationsApiBase(),
    });
  }
  return json;
}

export async function postConversationFileMessage(
  conversationId: string,
  payload: {
    file: File | Blob;
    fileName?: string;
    body?: string;
    replyToMessageId?: string;
  },
): Promise<PostConversationMessageResponse> {
  const form = new FormData();
  if (payload.file instanceof File) {
    form.append("file", payload.file);
  } else {
    form.append("file", payload.file, payload.fileName ?? "adjunto.pdf");
  }
  if (payload.body != null) form.append("body", payload.body);
  if (payload.replyToMessageId) form.append("replyToMessageId", payload.replyToMessageId);
  const res = await fetch(
    `${getLocalConversationsApiBase()}/conversations/${encodeURIComponent(conversationId)}/messages/file`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: form,
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al enviar archivo"));
  }
  return normalizeConversationMessage(await res.json()) as PostConversationMessageResponse;
}

export async function generateEntityPdfForChat(payload: {
  entityType: "PRODUCT" | "SUPPLIER" | "CLIENT" | "FV_STUDY" | "QUOTE" | "QUOTE_TEMPLATE";
  title: string;
  summary?: Record<string, unknown>;
}): Promise<Blob> {
  const res = await fetch(`${getLocalConversationsApiBase()}/conversations/share/entity-pdf`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "No se pudo generar el PDF"));
  }
  return res.blob();
}

export async function resolveConversationSharedEntity(
  messageId: string,
  payload: {
    decision: "REJECT" | "ACCEPT_CREATE_NEW" | "ACCEPT_USE_EXISTING" | "ACCEPT_LINK_EXISTING";
    existingEntityId?: string;
  },
): Promise<{ ok: true; status: "PENDING" | "INTEGRATED" | "REJECTED" | "ERROR"; targetEntityId?: string }> {
  const res = await fetch(
    `${getLocalConversationsApiBase()}/conversations/messages/${encodeURIComponent(messageId)}/shared-entity/resolve`,
    {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al resolver entidad compartida"));
  }
  return res.json();
}

export async function fetchConversationSharedEntityContext(
  messageId: string,
): Promise<{
  messageId: string;
  entityType:
    | "PRODUCT"
    | "SUPPLIER"
    | "CLIENT"
    | "FV_STUDY"
    | "QUOTE"
    | "QUOTE_TEMPLATE";
  snapshot: Record<string, unknown>;
  myStatus: "PENDING" | "INTEGRATED" | "REJECTED" | "ERROR";
  options: string[];
  candidates: Array<{ id: string; label: string }>;
}> {
  const res = await fetch(
    `${getLocalConversationsApiBase()}/conversations/messages/${encodeURIComponent(messageId)}/shared-entity/context`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al cargar contexto de entidad compartida"));
  }
  return res.json();
}

export async function toggleConversationMessageReaction(
  messageId: string,
  emoji: string,
): Promise<{
  ok: true;
  messageId: string;
  reactions: ConversationMessageDto["reactions"];
}> {
  const baseCandidates = [getLocalConversationsApiBase(), getApiBase()];
  let json: { ok: true; messageId: string; reactions?: unknown } | null = null;
  let lastErr: unknown = null;
  for (const base of baseCandidates) {
    const res = await fetch(
      `${base}/conversations/messages/${encodeURIComponent(messageId)}/reactions/toggle`,
      {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      },
    );
    if (res.ok) {
      json = (await res.json()) as { ok: true; messageId: string; reactions?: unknown };
      break;
    }
    const err = await res.json().catch(() => ({}));
    lastErr = err;
    if (res.status !== 404) {
      throw new Error(nestHttpErrorMessage(err, "Error al reaccionar mensaje"));
    }
  }
  if (!json) {
    throw new Error(nestHttpErrorMessage(lastErr, "No se encontró endpoint de reacciones en el nodo activo"));
  }
  return {
    ok: true,
    messageId: json.messageId,
    reactions: Array.isArray(json.reactions) ? (json.reactions as ConversationMessageDto["reactions"]) : [],
  };
}

export async function downloadConversationMessageAttachment(
  messageId: string,
  attachmentId: string,
): Promise<{ blob: Blob; fileName: string }> {
  const res = await fetch(
    `${getLocalConversationsApiBase()}/conversations/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(nestHttpErrorMessage(err, "Error al descargar archivo"));
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="([^"]+)"/i.exec(cd);
  const fileName = m?.[1] ? decodeURIComponent(m[1]) : "adjunto";
  return { blob, fileName };
}

export async function postConversationRead(
  conversationId: string,
): Promise<{ ok: true; lastReadAt: string }> {
  const res = await fetch(
    `${getLocalConversationsApiBase()}/conversations/${encodeURIComponent(conversationId)}/read`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Error al marcar leído");
  }
  return res.json();
}
