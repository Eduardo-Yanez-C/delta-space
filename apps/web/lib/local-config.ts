/**
 * Configuración local de la instalación (primera ejecución / despliegue local).
 * Se persiste en localStorage para que la URL del API y la activación sean configurables
 * sin recompilar. Base para enlazar instalación/equipo con el backend.
 */

const STORAGE_KEY = "pv_quoting_install_config";

export type LocalConfig = {
  /** URL base del API (ej. http://localhost:4000/api). Obligatorio para considerar "configurado". */
  apiBaseUrl: string;
  /** Código de activación ingresado por el usuario (opcional en fase inicial). */
  activationCode?: string;
  /** Identificador de instalación devuelto por el backend (para control/revocación futura). */
  installationId?: string;
  /** Token de instalación si el backend lo entrega (validación futura). */
  installationToken?: string;
  /** Marca de primera configuración completada. */
  configuredAt: string;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Devuelve la configuración local o null si no existe o está incompleta. */
export function getLocalConfig(): LocalConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const c = safeParse<Partial<LocalConfig>>(raw, {});
    if (c?.apiBaseUrl && typeof c.apiBaseUrl === "string" && c.apiBaseUrl.trim() !== "") {
      return {
        apiBaseUrl: c.apiBaseUrl.trim().replace(/\/$/, ""),
        activationCode: typeof c.activationCode === "string" ? c.activationCode : undefined,
        installationId: typeof c.installationId === "string" ? c.installationId : undefined,
        installationToken: typeof c.installationToken === "string" ? c.installationToken : undefined,
        configuredAt: typeof c.configuredAt === "string" ? c.configuredAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Guarda la configuración local. apiBaseUrl es obligatorio. */
export function setLocalConfig(config: {
  apiBaseUrl: string;
  activationCode?: string;
  installationId?: string;
  installationToken?: string;
}): void {
  if (typeof window === "undefined") return;
  const apiBaseUrl = config.apiBaseUrl.trim().replace(/\/$/, "");
  if (!apiBaseUrl) return;
  const toStore: LocalConfig = {
    apiBaseUrl,
    activationCode: config.activationCode,
    installationId: config.installationId,
    installationToken: config.installationToken,
    configuredAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

/** Indica si la instalación está configurada (tiene al menos URL del API). */
export function isConfigured(): boolean {
  return getLocalConfig() != null;
}

/** Quita solo las credenciales de instalación (id/token), mantiene apiBaseUrl. Útil tras revocación. */
export function clearInstallationCredentials(): void {
  const c = getLocalConfig();
  if (!c) return;
  setLocalConfig({
    apiBaseUrl: c.apiBaseUrl,
    activationCode: c.activationCode,
    installationId: undefined,
    installationToken: undefined,
  });
}
