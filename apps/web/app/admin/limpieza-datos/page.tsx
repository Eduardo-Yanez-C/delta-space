"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchDataCleanupStatus,
  postDataCleanupExecute,
  postDataCleanupPreview,
  type DataCleanupModuleKey,
  type DataCleanupPreviewResponse,
} from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

const MODULE_OPTIONS: { key: DataCleanupModuleKey; label: string; hint: string }[] = [
  { key: "CLIENTS", label: "Clientes", hint: "Registros en Client (cotizaciones/estudios previos si aplica)." },
  { key: "SUPPLIERS", label: "Proveedores", hint: "Supplier y vínculos N:M / precios por proveedor." },
  { key: "PRODUCTS", label: "Productos", hint: "Product, precios, specs; requiere cotizaciones/plantillas si las hay." },
  { key: "FV_STUDIES", label: "Estudios FV", hint: "FvStudy y diseño de implantación (cascada en BD)." },
  { key: "TEMPLATES", label: "Plantillas", hint: "QuoteTemplate y jerarquía de ítems/líneas." },
  { key: "QUOTES", label: "Cotizaciones", hint: "Quote, versiones, ítems, snapshots MARGIN ligados." },
  {
    key: "USERS",
    label: "Usuarios (desactivación masiva)",
    hint: "Pone active=false en todas las cuentas activas salvo la suya; no borra filas ni cotizaciones/estudios. Exige frase DESACTIVAR_USUARIOS. No toca chat, licencias, instalaciones ni perfil de empresa.",
  },
];

const CONFIRM = "LIMPIAR";
const CONFIRM_USERS = "DESACTIVAR_USUARIOS";

function moduleLabel(k: DataCleanupModuleKey): string {
  return MODULE_OPTIONS.find((m) => m.key === k)?.label ?? k;
}

export default function LimpiezaDatosPage() {
  const { user } = useAuth();
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [pickAll, setPickAll] = useState(false);
  const [picked, setPicked] = useState<Record<DataCleanupModuleKey, boolean>>(() => ({
    QUOTES: false,
    FV_STUDIES: false,
    CLIENTS: false,
    TEMPLATES: false,
    PRODUCTS: false,
    SUPPLIERS: false,
    USERS: false,
  }));
  const [preview, setPreview] = useState<DataCleanupPreviewResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [usersPhrase, setUsersPhrase] = useState("");
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const s = await fetchDataCleanupStatus();
      setFeatureEnabled(s.enabled);
    } catch (e) {
      setFeatureEnabled(false);
      setError(e instanceof Error ? e.message : "No se pudo cargar el estado");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const selectionPayload = useMemo(() => {
    if (pickAll) return { all: true as const };
    const modules = (Object.keys(picked) as DataCleanupModuleKey[]).filter((k) => picked[k]);
    return { modules };
  }, [pickAll, picked]);

  const toggleModule = (key: DataCleanupModuleKey) => {
    setPickAll(false);
    setPicked((p) => ({ ...p, [key]: !p[key] }));
    setPreview(null);
    setDoneMsg(null);
  };

  const onToggleAll = (checked: boolean) => {
    setPickAll(checked);
    if (checked) {
      setPicked({
        QUOTES: true,
        FV_STUDIES: true,
        CLIENTS: true,
        TEMPLATES: true,
        PRODUCTS: true,
        SUPPLIERS: true,
        USERS: true,
      });
    } else {
      setPicked({
        QUOTES: false,
        FV_STUDIES: false,
        CLIENTS: false,
        TEMPLATES: false,
        PRODUCTS: false,
        SUPPLIERS: false,
        USERS: false,
      });
    }
    setPreview(null);
    setDoneMsg(null);
  };

  const analyze = async () => {
    if (!featureEnabled) return;
    setAnalyzing(true);
    setError(null);
    setDoneMsg(null);
    setPreview(null);
    try {
      if (!pickAll && !selectionPayload.modules?.length) {
        setError("Seleccione al menos un módulo o marque «Todo».");
        return;
      }
      const r = await postDataCleanupPreview(selectionPayload);
      setPreview(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al analizar");
    } finally {
      setAnalyzing(false);
    }
  };

  const runExecute = async () => {
    if (!featureEnabled || !preview) return;
    setExecuting(true);
    setError(null);
    try {
      const r = await postDataCleanupExecute({
        ...selectionPayload,
        password,
        confirmPhrase: phrase,
        ...(preview.expandedModules.includes("USERS") ? { confirmUsersPhrase: usersPhrase.trim() } : {}),
      });
      const total = Object.values(r.deleted).reduce((a, b) => a + b, 0);
      setDoneMsg(`Limpieza completada. Filas afectadas (deleteMany): ${total}. Revise los logs del servidor para detalle.`);
      setExecuteOpen(false);
      setPassword("");
      setPhrase("");
      setUsersPhrase("");
      setPreview(null);
      setPickAll(false);
      setPicked({
        QUOTES: false,
        FV_STUDIES: false,
        CLIENTS: false,
        TEMPLATES: false,
        PRODUCTS: false,
        SUPPLIERS: false,
        USERS: false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al ejecutar");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Limpieza de datos</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Elimina por módulos datos operativos. El módulo <strong>Usuarios</strong> solo{" "}
          <strong>desactiva cuentas</strong> (mantiene historial y referencias en cotizaciones, estudios y panel
          comercial). Requiere contraseña + LIMPIAR + frase DESACTIVAR_USUARIOS; no desactiva su usuario ni deja sin
          administrador activo. No elimina códigos de activación, instalaciones ni perfil de empresa. Variable en el API:{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">ENABLE_ADMIN_DATA_CLEANUP=true</code>.
        </p>
      </div>

      {loadingStatus ? (
        <p className="text-sm text-slate-500">Cargando estado…</p>
      ) : featureEnabled === false ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          <p className="font-medium">Funcionalidad deshabilitada</p>
          <p className="mt-1 opacity-90">
            El API no tiene activada la limpieza administrativa. En el entorno del servidor Nest, defina{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">ENABLE_ADMIN_DATA_CLEANUP=true</code> y
            reinicie el proceso. En producción déjela sin definir o en <code className="px-1">false</code>.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {doneMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100">
          {doneMsg}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Qué limpiar</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          «Todo» marca los siete módulos. Usuarios se ejecuta al final y solo desactiva cuentas; el resto de módulos sigue
          siendo borrado físico de datos comerciales/catálogo como antes.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
            checked={pickAll}
            onChange={(e) => onToggleAll(e.target.checked)}
            disabled={!featureEnabled}
          />
          <div>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Todo (los siete módulos)</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Incluye desactivación masiva de usuarios al final (no borrado físico de cuentas). No toca licencias,
              instalaciones ni perfil de empresa.
            </p>
          </div>
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MODULE_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 p-2.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={pickAll || picked[opt.key]}
                onChange={() => toggleModule(opt.key)}
                disabled={!featureEnabled || pickAll}
              />
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
                <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{opt.hint}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={!featureEnabled || analyzing}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {analyzing ? "Analizando…" : "Analizar"}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Vista previa</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Orden efectivo: {preview.expandedModules.map(moduleLabel).join(" → ")}
          </p>
          {preview.dependencyNotes.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-800 dark:text-amber-200/90">
              {preview.dependencyNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-100 dark:border-slate-600">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Clave</th>
                  <th className="px-2 py-1.5 font-medium">Registros</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(preview.counts)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([k, v]) => (
                    <tr key={k} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-2 py-1 font-mono text-slate-700 dark:text-slate-300">{k}</td>
                      <td className="px-2 py-1 tabular-nums text-slate-900 dark:text-slate-100">{v}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => {
              setExecuteOpen(true);
              setPassword("");
              setPhrase("");
              setUsersPhrase("");
            }}
            disabled={!featureEnabled}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Ejecutar limpieza…
          </button>
        </div>
      ) : null}

      {executeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cleanup-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <h4 id="cleanup-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Confirmar limpieza
            </h4>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Cuenta: <span className="font-medium text-slate-800 dark:text-slate-200">{user?.email ?? "—"}</span>.
              Ingrese su contraseña actual y escriba <strong className="text-slate-900 dark:text-slate-100">{CONFIRM}</strong>{" "}
              para continuar.
            </p>
            <label className="mt-3 block text-xs font-medium text-slate-700 dark:text-slate-300">Contraseña</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <label className="mt-3 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Confirmación ({CONFIRM})
            </label>
            <input
              type="text"
              autoComplete="off"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            {preview?.expandedModules.includes("USERS") ? (
              <>
                <label className="mt-3 block text-xs font-medium text-amber-900 dark:text-amber-200/90">
                  Confirmación adicional para desactivar usuarios ({CONFIRM_USERS})
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={usersPhrase}
                  onChange={(e) => setUsersPhrase(e.target.value)}
                  placeholder={CONFIRM_USERS}
                  className="mt-1 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm dark:border-amber-700 dark:bg-slate-800"
                />
                <p className="mt-2 text-xs text-amber-900/90 dark:text-amber-200/80">
                  Solo administradores llegan a esta pantalla. No se desactiva su usuario ni se deja el sistema sin al
                  menos un ADMIN o ADMIN_DEV activo. Las filas de usuario permanecen para trazabilidad en cotizaciones y
                  estudios.
                </p>
              </>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExecuteOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  executing ||
                  phrase !== CONFIRM ||
                  !password ||
                  (Boolean(preview?.expandedModules.includes("USERS")) && usersPhrase.trim() !== CONFIRM_USERS)
                }
                onClick={() => void runExecute()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-700"
              >
                {executing ? "Ejecutando…" : "Confirmar limpieza"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
