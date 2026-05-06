"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setLocalConfig } from "../../lib/local-config";
import { useTheme } from "../../lib/theme-context";
import { activateInstallation } from "../../lib/api";

export default function SetupPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const url = apiBaseUrl.trim().replace(/\/$/, "");
    if (!url) {
      setError("La URL del API es obligatoria.");
      return;
    }
    const base = url.startsWith("http") ? url : `http://${url}`;
    const codeTrim = activationCode.trim();
    setSaving(true);
    try {
      const res = await fetch(`${base}/health`);
      if (!res.ok) throw new Error(`Backend respondió ${res.status}`);
      const data = await res.json().catch(() => ({}));
      if (data?.ok !== true) throw new Error("El backend no devolvió ok.");

      let installationId: string | undefined;
      let installationToken: string | undefined;
      if (codeTrim) {
        const activated = await activateInstallation(base, {
          activationCode: codeTrim,
          deviceName: deviceName.trim() || undefined,
        });
        installationId = activated.installationId;
        installationToken = activated.installationToken;
      }

      setLocalConfig({
        apiBaseUrl: base,
        activationCode: codeTrim || undefined,
        installationId,
        installationToken,
      });
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar al API. Compruebe la URL y que el backend esté en ejecución.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-900">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        aria-label={theme === "dark" ? "Usar modo claro" : "Usar modo oscuro"}
      >
        {theme === "dark" ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500 text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
        <h1 className="text-center text-xl font-semibold text-slate-900 dark:text-slate-100">
          Configuración inicial
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
          Configure la conexión al servidor antes de usar la aplicación.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-invalid={!!error}>
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          )}
          <div>
            <label htmlFor="apiBaseUrl" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              URL del API (servidor backend)
            </label>
            <input
              id="apiBaseUrl"
              type="url"
              inputMode="url"
              autoComplete="url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="http://localhost:4000/api"
              className="input-field"
              disabled={saving}
            />
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Ejemplo: http://localhost:4000/api o la dirección de su servidor.
            </p>
          </div>
          <div>
            <label htmlFor="activationCode" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Código de activación <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              id="activationCode"
              type="text"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              placeholder="Deje vacío para modo sin activación"
              className="input-field"
              disabled={saving}
            />
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Si tiene código, la instalación quedará registrada en el servidor. Sin código puede usar la app en modo local.
            </p>
          </div>
          {activationCode.trim() && (
            <div>
              <label htmlFor="deviceName" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nombre del equipo <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                id="deviceName"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Ej. PC Oficina Santiago"
                className="input-field"
                disabled={saving}
              />
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Comprobando conexión…" : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
