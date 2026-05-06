"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchQuoteAddOns,
  fetchAddonInputs,
  setAddonInputs,
  fetchAddonSuggestions,
  evaluateAddonSuggestions,
  acceptAddonSuggestion,
  rejectAddonSuggestion,
  type QuoteAddOnRule,
  type AddonSuggestionItem,
} from "../../../lib/api";
import { formatMoney } from "../../../lib/format";

/** Labels, unidades y tipo por inputKey (reglas Fase 2.5). Booleanos: valor "1" = sí, "0" = no. */
const INPUT_KEY_META: Record<
  string,
  { label: string; unit?: string; type: "number" | "boolean" }
> = {
  canalizacion_metros: { label: "Canalización total", unit: "m", type: "number" },
  cable_metros: { label: "Cable total", unit: "m", type: "number" },
  montaje_especial: { label: "Requiere montaje especial", type: "boolean" },
  protecciones_extra: { label: "Protecciones adicionales", type: "boolean" },
  traslado_km: { label: "Traslado", unit: "km", type: "number" },
  zanja_metros: { label: "Zanja / canalización enterrada", unit: "m", type: "number" },
  ingenieria_extra: { label: "Ingeniería adicional", type: "boolean" },
};

const SUGGESTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
};

type Props = {
  quoteId: string;
  versionId: string;
  canEdit: boolean;
  currency?: string;
  onRefreshVersion?: () => void;
};

export function AdicionalesSection({ quoteId, versionId, canEdit, currency: _currency = "", onRefreshVersion }: Props) {
  const [rules, setRules] = useState<QuoteAddOnRule[]>([]);
  const [suggestions, setSuggestions] = useState<AddonSuggestionItem[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingInputs, setLoadingInputs] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [savingParams, setSavingParams] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [actionSuggestionId, setActionSuggestionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paramsError, setParamsError] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const inputKeysFromRules = rules.length > 0
    ? Array.from(new Set(rules.map((r) => r.inputKey)))
    : [];
  const ruleByInputKey = (key: string) => rules.find((r) => r.inputKey === key);
  const getInputLabel = (inputKey: string, unit: string) => {
    const meta = INPUT_KEY_META[inputKey];
    if (meta) return meta.unit ? `${meta.label} (${meta.unit})` : meta.label;
    return `${inputKey}${unit ? ` (${unit})` : ""}`;
  };
  const getInputType = (inputKey: string): "number" | "boolean" =>
    INPUT_KEY_META[inputKey]?.type ?? "number";
  const numericInputKeys = inputKeysFromRules.filter((k) => getInputType(k) === "number");
  const booleanInputKeys = inputKeysFromRules.filter((k) => getInputType(k) === "boolean");

  const loadInputs = useCallback(() => {
    setLoadingInputs(true);
    setError(null);
    fetchAddonInputs(quoteId, versionId)
      .then((res) => {
        setParamValues((prev) => {
          const next = { ...prev };
          for (const i of res.inputs) {
            const isBoolean = INPUT_KEY_META[i.inputKey]?.type === "boolean";
            const v = i.valueNumeric ?? i.valueText ?? "";
            if (isBoolean) {
              next[i.inputKey] =
                i.valueNumeric === 1 || i.valueText === "true" ? "1" : "0";
            } else {
              next[i.inputKey] =
                v === null || v === undefined ? "" : String(v);
            }
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setLoadingInputs(false));
  }, [quoteId, versionId]);

  const loadSuggestions = useCallback(() => {
    setLoadingSuggestions(true);
    fetchAddonSuggestions(quoteId, versionId)
      .then((res) => setSuggestions(res.suggestions))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false));
  }, [quoteId, versionId]);

  useEffect(() => {
    setLoadingRules(true);
    setError(null);
    fetchQuoteAddOns()
      .then(setRules)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Error al cargar reglas");
        setRules([]);
      })
      .finally(() => setLoadingRules(false));
  }, []);

  useEffect(() => {
    loadInputs();
  }, [loadInputs]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleSaveParams = () => {
    if (!canEdit) return;
    setParamsError(null);
    setSuccessMessage(null);
    setSavingParams(true);
    const body = {
      inputs: inputKeysFromRules.map((inputKey) => {
        const isBoolean = getInputType(inputKey) === "boolean";
        const value = paramValues[inputKey] ?? "";
        if (isBoolean) {
          const on = value === "1";
          return {
            inputKey,
            valueNumeric: on ? 1 : 0,
            valueText: on ? "true" : "false",
          };
        }
        const num = value === "" ? null : Number(value);
        return {
          inputKey,
          valueNumeric: num !== null && !Number.isNaN(num) ? num : null,
          valueText: value === "" ? null : value,
        };
      }),
    };
    setAddonInputs(quoteId, versionId, body)
      .then((res) => {
        setParamValues((prev) => {
          const next = { ...prev };
          for (const i of res.inputs) {
            const v = i.valueNumeric ?? i.valueText ?? "";
            next[i.inputKey] = v === null || v === undefined ? "" : String(v);
          }
          return next;
        });
        setSuccessMessage("Parámetros guardados.");
      })
      .catch((e) => setParamsError(e instanceof Error ? e.message : "Error al guardar"))
      .finally(() => setSavingParams(false));
  };

  const handleEvaluate = () => {
    if (!canEdit) return;
    setEvalError(null);
    setEvaluating(true);
    evaluateAddonSuggestions(quoteId, versionId)
      .then((res) => setSuggestions(res.suggestions))
      .catch((e) => setEvalError(e instanceof Error ? e.message : "Error al evaluar"))
      .finally(() => setEvaluating(false));
  };

  const handleAccept = (s: AddonSuggestionItem) => {
    if (!canEdit || s.status !== "PENDING") return;
    setActionError(null);
    setActionSuggestionId(s.id);
    acceptAddonSuggestion(quoteId, versionId, s.id)
      .then(() => {
        loadSuggestions();
        onRefreshVersion?.();
      })
      .catch((e) => setActionError(e instanceof Error ? e.message : "Error al aceptar"))
      .finally(() => setActionSuggestionId(null));
  };

  const handleReject = (s: AddonSuggestionItem) => {
    if (!canEdit || s.status !== "PENDING") return;
    setActionError(null);
    setActionSuggestionId(s.id);
    rejectAddonSuggestion(quoteId, versionId, s.id)
      .then(() => loadSuggestions())
      .catch((e) => setActionError(e instanceof Error ? e.message : "Error al rechazar"))
      .finally(() => setActionSuggestionId(null));
  };

  if (loadingRules) {
    return (
      <div className="card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Adicionales
        </h3>
        <p className="mt-2 text-sm text-slate-500">Cargando reglas…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Adicionales
        </h3>
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Adicionales
        </h3>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          No hay <strong>reglas de adicionales activas</strong> en el catálogo del sistema.
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Esto es una configuración maestra (no depende del estado comercial de la cotización). Cuando un
          administrador active reglas, aquí podrá ingresar parámetros y generar sugerencias.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Parámetros y sugerencias de adicionales
      </h3>

      {/* Parámetros */}
      <div className="mt-4">
        <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Parámetros
        </h4>
        {loadingInputs ? (
          <p className="mt-2 text-sm text-slate-500">Cargando parámetros…</p>
        ) : (
          <>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 lg:col-span-2 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Parámetros numéricos
                </p>
                {numericInputKeys.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay parámetros numéricos configurados.</p>
                ) : (
                  <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    {numericInputKeys.map((inputKey) => {
                      const rule = ruleByInputKey(inputKey);
                      const unit = rule?.unit ?? "";
                      const label = getInputLabel(inputKey, unit);
                      const value = paramValues[inputKey] ?? "";
                      return (
                        <div key={inputKey}>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {label}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={value}
                            onChange={(e) =>
                              setParamValues((prev) => ({
                                ...prev,
                                [inputKey]: e.target.value,
                              }))
                            }
                            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Opciones adicionales
                </p>
                {booleanInputKeys.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay opciones booleanas configuradas.</p>
                ) : (
                  <div className="space-y-2.5">
                    {booleanInputKeys.map((inputKey) => {
                      const rule = ruleByInputKey(inputKey);
                      const unit = rule?.unit ?? "";
                      const label = getInputLabel(inputKey, unit);
                      const value = paramValues[inputKey] ?? "0";
                      return (
                        <label key={inputKey} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={value === "1"}
                            onChange={(e) =>
                              setParamValues((prev) => ({
                                ...prev,
                                [inputKey]: e.target.checked ? "1" : "0",
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleSaveParams}
                  disabled={savingParams}
                  className="btn-secondary disabled:opacity-50"
                >
                  {savingParams ? "Guardando…" : "Guardar parámetros"}
                </button>
                <button
                  type="button"
                  onClick={handleEvaluate}
                  disabled={evaluating}
                  className="btn-primary disabled:opacity-50"
                >
                  {evaluating ? "Evaluando…" : "Sugerir adicionales"}
                </button>
              </div>
            )}
            {successMessage && (
              <p className="mt-2 text-sm text-emerald-600" role="status">
                {successMessage}
              </p>
            )}
            {paramsError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {paramsError}
              </p>
            )}
            {evalError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {evalError}
              </p>
            )}
          </>
        )}
      </div>

      {/* Sugerencias */}
      <div className="mt-6">
        <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Sugerencias
        </h4>
        {loadingSuggestions ? (
          <p className="mt-2 text-sm text-slate-500">Cargando sugerencias…</p>
        ) : suggestions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No hay sugerencias. Ingrese parámetros (por ejemplo metros de canalización) y pulse «Sugerir adicionales».
          </p>
        ) : (
          <>
            {actionError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {actionError}
                <button type="button" onClick={() => setActionError(null)} className="ml-2 underline">
                  Cerrar
                </button>
              </p>
            )}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-700">Nombre</th>
                    <th className="px-4 py-2 font-medium text-slate-700">Descripción</th>
                    <th className="px-4 py-2 font-medium text-slate-700 text-right">Cantidad</th>
                    <th className="px-4 py-2 font-medium text-slate-700 text-right">P. unit.</th>
                    <th className="px-4 py-2 font-medium text-slate-700">Estado</th>
                    {canEdit && (
                      <th className="px-4 py-2 font-medium text-slate-700 w-40">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suggestions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {s.description ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {s.suggestedQuantity} {s.unit}
                      </td>
                      <td className="px-4 py-2 text-right">
                        $ {formatMoney(s.suggestedUnitPrice, "")}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            s.status === "PENDING"
                              ? "inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                              : s.status === "ACCEPTED"
                                ? "inline-flex rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                                : "inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                          }
                        >
                          {SUGGESTION_STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-2">
                          {s.status === "PENDING" ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleAccept(s)}
                                disabled={actionSuggestionId !== null}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                              >
                                {actionSuggestionId === s.id ? "…" : "Aceptar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(s)}
                                disabled={actionSuggestionId !== null}
                                className="text-sm font-medium text-slate-600 hover:text-slate-700 disabled:opacity-50"
                              >
                                {actionSuggestionId === s.id ? "…" : "Rechazar"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
