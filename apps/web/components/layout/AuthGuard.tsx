"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { getLocalConfig, isConfigured, setLocalConfig, clearInstallationCredentials } from "../../lib/local-config";
import { registerP2pIdentity, validateInstallation } from "../../lib/api";
import { AppLayout } from "./AppLayout";

type InstallationStatus = "pending" | "valid" | "invalid";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [configChecked, setConfigChecked] = useState(false);
  const [installationStatus, setInstallationStatus] = useState<InstallationStatus>("pending");
  const isLoginPage = pathname === "/login";
  const isSetupPage = pathname === "/setup";
  const isDev = process.env.NODE_ENV === "development";
  const isEmbedded =
    typeof window !== "undefined" &&
    new URL(window.location.href).searchParams.get("embedded") === "1";
  /** Misma heurística que `getApiBase()` en lib/api.ts (PROD_PORT del .exe). */
  const isDesktopPackagedShell =
    typeof window !== "undefined" &&
    window.location.port === "31337" &&
    (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost");
  /** En desarrollo, ?embedded=1 o shell desktop empaquetado: no exigimos /setup por localStorage. */
  const effectiveConfigured = isConfigured() || isDev || isEmbedded || isDesktopPackagedShell;

  /**
   * Desktop empaquetado (?embedded=1): el API Nest vive siempre en :4000.
   * Si el usuario ya tenía localStorage de desarrollo (p. ej. http://localhost:3000/api o :31337/api),
   * las fetch irían al servidor Next → 500 / HTML y "Internal server error" en la UI.
   * Por eso forzamos la URL del API embebido y conservamos credenciales de instalación.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isEmbedded && !isDesktopPackagedShell) return;
    const EMBEDDED_API = "http://127.0.0.1:4000/api";
    const prev = getLocalConfig();
    if (prev?.apiBaseUrl === EMBEDDED_API) return;
    setLocalConfig({
      apiBaseUrl: EMBEDDED_API,
      activationCode: prev?.activationCode,
      installationId: prev?.installationId,
      installationToken: prev?.installationToken,
    });
  }, [isEmbedded, isDesktopPackagedShell]);

  // Primera ejecución: marcar config como revisada
  useEffect(() => {
    if (typeof window === "undefined") return;
    setConfigChecked(true);
  }, []);

  // Validar instalación cuando hay installationId + installationToken (modo activado)
  useEffect(() => {
    if (!configChecked || isSetupPage) return;
    if (!effectiveConfigured) return;
    const config = getLocalConfig();
    if (!config?.installationId || !config?.installationToken) {
      setInstallationStatus("valid");
      return;
    }
    let cancelled = false;
    validateInstallation({
      installationId: config.installationId,
      installationToken: config.installationToken,
    })
      .then((res) => {
        if (cancelled) return;
        setInstallationStatus(res.valid ? "valid" : "invalid");
      })
      .catch(() => {
        if (cancelled) return;
        setInstallationStatus("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [configChecked, isSetupPage, effectiveConfigured]);

  /** Mapeo usuario ↔ peerId para chat P2P (daemon local + Nest). */
  useEffect(() => {
    if (!user || loading) return;
    void registerP2pIdentity();
  }, [user, loading]);

  // Redirecciones: setup, login, home (en desarrollo sin config no se exige /setup)
  useEffect(() => {
    if (!configChecked) return;
    if (!effectiveConfigured && !isSetupPage) {
      router.replace("/setup");
      return;
    }
    if (isSetupPage) return;
    if (installationStatus !== "valid") return;
    if (loading) return;
    if (isLoginPage) {
      if (user) router.replace("/");
      return;
    }
    if (!user) {
      router.replace("/login");
    }
  }, [configChecked, effectiveConfigured, installationStatus, loading, user, isLoginPage, isSetupPage, router]);

  if (!configChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-500 dark:text-slate-400">Cargando…</div>
      </div>
    );
  }

  if (!effectiveConfigured && !isSetupPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-500 dark:text-slate-400">Redirigiendo a configuración…</div>
      </div>
    );
  }

  if (isSetupPage) {
    return <>{children}</>;
  }

  if (installationStatus === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-500 dark:text-slate-400">Validando instalación…</div>
      </div>
    );
  }

  if (installationStatus === "invalid") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 dark:bg-slate-900">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-900/20">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Esta instalación ya no es válida o fue revocada.
          </p>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Debe volver a configurar la aplicación. Si tiene un nuevo código de activación, podrá ingresarlo en la pantalla de configuración.
          </p>
          <button
            type="button"
            onClick={() => {
              clearInstallationCredentials();
              router.replace("/setup");
              router.refresh();
            }}
            className="btn-primary mt-4"
          >
            Ir a configuración inicial
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-500 dark:text-slate-400">Cargando sesión…</div>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-slate-500 dark:text-slate-400">Redirigiendo a login…</div>
      </div>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}
