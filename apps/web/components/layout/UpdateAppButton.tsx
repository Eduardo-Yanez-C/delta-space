"use client";

import { useState } from "react";

declare global {
  interface Window {
    __DESKTOP__?: {
      isDesktop: boolean;
      getAppVersion: () => Promise<string>;
      selectUpdateFolder: (opts?: { pick?: "manifest" }) => Promise<string | null>;
      validateUpdateFolder: (path: string) => Promise<{
        valid: boolean;
        error?: string;
        currentVersion?: string;
        newVersion?: string;
        updateMode?: "installer" | "replace";
        releaseNotes?: string | null;
        installerFileName?: string;
        installerSha256?: string;
      }>;
      applyUpdate: (path: string) => Promise<{ ok: boolean; message?: string }>;
      spellcheck?: {
        getSettings: () => Promise<{
          enabled: boolean;
          languages: string[];
          showRightClickSuggestions?: boolean;
        }>;
        setSettings: (p: {
          enabled: boolean;
          languages: string[];
          showRightClickSuggestions?: boolean;
        }) => Promise<{ ok: boolean; error?: string }>;
      };
    };
  }
}

type ValidationResult = {
  valid: boolean;
  error?: string;
  currentVersion?: string;
  newVersion?: string;
  updateMode?: "installer" | "replace";
  releaseNotes?: string | null;
  installerFileName?: string;
  installerSha256?: string;
};

export function UpdateAppButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const [awaitingSource, setAwaitingSource] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const api = typeof window !== "undefined" ? window.__DESKTOP__ : undefined;
  if (!api?.isDesktop) return null;

  const runValidationForPath = async (folderPath: string | null) => {
    if (!folderPath) return;
    setError(null);
    setValidation(null);
    setResultMessage(null);
    setSelectedPath(folderPath);
    setBusy(true);
    try {
      const result = await api.validateUpdateFolder(folderPath);
      if (!result.valid) {
        setError(result.error ?? "Paquete no válido");
        setValidation(null);
        return;
      }
      setValidation(result);
      setAwaitingSource(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al validar");
      setValidation(null);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenModal = () => {
    setError(null);
    setValidation(null);
    setResultMessage(null);
    setSelectedPath(null);
    setAwaitingSource(true);
    setModalOpen(true);
  };

  const handlePickFolder = async () => {
    setBusy(true);
    try {
      const folderPath = await api.selectUpdateFolder();
      await runValidationForPath(folderPath);
    } finally {
      setBusy(false);
    }
  };

  const handlePickManifest = async () => {
    setBusy(true);
    try {
      const folderPath = await api.selectUpdateFolder({ pick: "manifest" });
      await runValidationForPath(folderPath);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!validation?.valid || !api || !selectedPath) return;
    setBusy(true);
    try {
      const res = await api.applyUpdate(selectedPath);
      setResultMessage(res.message ?? (res.ok ? "Listo." : "Error."));
    } catch (e) {
      setResultMessage(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setModalOpen(false);
    setAwaitingSource(true);
    setError(null);
    setSelectedPath(null);
    setValidation(null);
    setResultMessage(null);
  };

  const backToSource = () => {
    setError(null);
    setValidation(null);
    setSelectedPath(null);
    setResultMessage(null);
    setAwaitingSource(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={busy}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700"
      >
        Actualizar aplicación
      </button>
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="update-app-title"
        >
          <div className="max-h-[90vh] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h2 id="update-app-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Actualizar aplicación
            </h2>

            {awaitingSource && !error && !validation && (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Paquete <strong>offline</strong> (carpeta con <code className="text-xs">manifest.json</code> e
                  instalador <code className="text-xs">.exe</code>) o carpeta <strong>portable completa</strong> (copia de
                  la app sin NSIS).
                </p>
                {busy ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Validando paquete…</p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handlePickFolder()}
                    disabled={busy}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                  >
                    {busy ? "…" : "Elegir carpeta del paquete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePickManifest()}
                    disabled={busy}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                  >
                    Elegir manifest.json…
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                <button
                  type="button"
                  onClick={backToSource}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600"
                >
                  Volver a elegir origen
                </button>
              </div>
            )}

            {validation?.valid && !resultMessage && (
              <>
                <dl className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="shrink-0 font-medium text-slate-500 dark:text-slate-500">Versión actual</dt>
                    <dd className="font-mono text-slate-900 dark:text-slate-100">{validation.currentVersion}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="shrink-0 font-medium text-slate-500 dark:text-slate-500">Versión destino</dt>
                    <dd className="font-mono text-slate-900 dark:text-slate-100">{validation.newVersion}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="shrink-0 font-medium text-slate-500 dark:text-slate-500">Modo</dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      {validation.updateMode === "installer"
                        ? "Instalador NSIS (offline)"
                        : "Reemplazo de carpeta portable"}
                    </dd>
                  </div>
                  {selectedPath ? (
                    <div className="flex flex-col gap-0.5">
                      <dt className="font-medium text-slate-500 dark:text-slate-500">Ruta del paquete</dt>
                      <dd className="break-all font-mono text-xs text-slate-800 dark:text-slate-200">{selectedPath}</dd>
                    </div>
                  ) : null}
                  {validation.updateMode === "installer" && validation.installerSha256 ? (
                    <div className="flex flex-col gap-0.5">
                      <dt className="font-medium text-slate-500 dark:text-slate-500">SHA-256 del instalador (verificado)</dt>
                      <dd className="break-all font-mono text-xs text-slate-800 dark:text-slate-200">
                        {validation.installerSha256}
                        {validation.installerFileName ? (
                          <span className="mt-0.5 block font-sans text-[11px] text-slate-500">
                            Archivo: {validation.installerFileName}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ) : validation.updateMode === "replace" ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Paquete portable: no hay comprobación SHA-256 en este flujo.
                    </p>
                  ) : null}
                </dl>
                {validation.releaseNotes ? (
                  <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                    <p className="font-medium text-slate-800 dark:text-slate-200">Notas de la versión</p>
                    <pre className="mt-1 whitespace-pre-wrap font-sans">{validation.releaseNotes}</pre>
                  </div>
                ) : null}
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  {validation.updateMode === "installer"
                    ? "Se cerrará la aplicación y se abrirá el instalador. Complete el asistente; sus datos, licencia y configuración en la carpeta de usuario de la app no se borran con esta acción."
                    : "Se reemplazará la carpeta de la aplicación por la versión seleccionada (copia de seguridad de la versión actual). La aplicación se cerrará y volverá a abrirse."}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">¿Desea continuar?</p>
              </>
            )}

            {resultMessage && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{resultMessage}</p>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {validation?.valid && !resultMessage ? (
                <>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={busy}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {busy ? "Aplicando…" : "Confirmar actualización"}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                </>
              ) : resultMessage || (!awaitingSource && (error || validation)) ? (
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cerrar
                </button>
              ) : awaitingSource ? (
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
