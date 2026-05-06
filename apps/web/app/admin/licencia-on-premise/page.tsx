"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchOnPremiseLicenseStatus,
  uploadOnPremiseLicenseToken,
  type OnPremiseLicenseStatusDto,
  type OnPremiseLicenseUiState,
} from "../../../lib/api";

function stateLabel(s: OnPremiseLicenseUiState): string {
  const map: Record<OnPremiseLicenseUiState, string> = {
    OK: "Válida",
    MISSING: "Sin archivo de licencia",
    INVALID: "Inválida",
    EXPIRED: "Expirada",
    INSTALLATION_MISMATCH: "Instalación no coincide",
    PUBLIC_KEY_NOT_CONFIGURED: "Clave pública no configurada",
    DISABLED: "Enforcement desactivado",
  };
  return map[s] ?? s;
}

function stateBadgeClass(s: OnPremiseLicenseUiState): string {
  if (s === "OK") return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (s === "DISABLED") return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
}

function formatExpires(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function LicenciaOnPremisePage() {
  const [status, setStatus] = useState<OnPremiseLicenseStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jwtInput, setJwtInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const s = await fetchOnPremiseLicenseStatus();
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar estado");
      setStatus(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyInstallationId = async () => {
    if (!status?.installationId) return;
    try {
      await navigator.clipboard.writeText(status.installationId);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  };

  const saveLicense = async () => {
    const t = jwtInput.trim();
    if (!t) {
      setError("Pegue el JWT de licencia antes de guardar.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaveOk(null);
    try {
      await uploadOnPremiseLicenseToken(t);
      setSaveOk("Licencia guardada correctamente.");
      setJwtInput("");
      await load({ silent: true });
    } catch (e) {
      setSaveOk(null);
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Licencia on-premise
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Estado del servidor local, <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">installationId</code>{" "}
            y carga del archivo <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">license.jwt</code>.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          disabled={loading || refreshing}
          onClick={() => void load()}
        >
          {refreshing ? "Actualizando…" : "Actualizar estado"}
        </button>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {saveOk && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-200">
          {saveOk}
        </div>
      )}

      {loading && !status && (
        <p className="text-sm text-slate-500">Cargando estado…</p>
      )}

      {status && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Estado</span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${stateBadgeClass(status.state)}`}
            >
              {stateLabel(status.state)}
            </span>
            <span className="text-xs text-slate-500">({status.state})</span>
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-300">{status.message}</p>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500 dark:text-slate-400">Empresa</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{status.empresa ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500 dark:text-slate-400">Modalidad</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{status.modalidad ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500 dark:text-slate-400">Expiración</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{formatExpires(status.expiresAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500 dark:text-slate-400">installationId</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                  {status.installationId}
                </code>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  onClick={() => void copyInstallationId()}
                >
                  {copyOk ? "Copiado" : "Copiar"}
                </button>
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Subir licencia (JWT)</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Pegue el token completo. El servidor valida firma RS256, <code className="rounded bg-slate-100 px-0.5 dark:bg-slate-800">installationId</code> y
          modalidad on-premise antes de guardar.
        </p>
        <textarea
          className="min-h-[120px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          placeholder="eyJhbGciOiJSUzI1NiIs..."
          value={jwtInput}
          onChange={(e) => setJwtInput(e.target.value)}
          spellCheck={false}
        />
        <button
          type="button"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          disabled={saving || !jwtInput.trim()}
          onClick={() => void saveLicense()}
        >
          {saving ? "Guardando…" : "Guardar licencia"}
        </button>
      </div>
    </div>
  );
}
