"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

type ColId = string;

export function InventoryTableColumnsDrawer({
  open,
  onClose,
  orderedColumnIds,
  colLabels,
  colVisible,
  setColVisible,
  fixedColumnIds,
}: {
  open: boolean;
  onClose: () => void;
  orderedColumnIds: readonly ColId[];
  colLabels: Record<ColId, string>;
  colVisible: Record<ColId, boolean>;
  setColVisible: Dispatch<SetStateAction<Record<ColId, boolean>>>;
  fixedColumnIds: readonly ColId[];
}) {
  const [fieldQ, setFieldQ] = useState("");

  useEffect(() => {
    if (open) setFieldQ("");
  }, [open]);

  const fixedSet = useMemo(() => new Set(fixedColumnIds), [fixedColumnIds]);

  const filteredIds = useMemo(() => {
    const q = fieldQ.trim().toLowerCase();
    return orderedColumnIds.filter((id) => {
      if (fixedSet.has(id)) return true;
      if (!q) return true;
      return (colLabels[id] ?? id).toLowerCase().includes(q);
    });
  }, [fieldQ, orderedColumnIds, colLabels, fixedSet]);

  const shownCols = useMemo(
    () => filteredIds.filter((id) => fixedSet.has(id) || colVisible[id] !== false),
    [filteredIds, colVisible, fixedSet],
  );

  const hiddenCols = useMemo(
    () => filteredIds.filter((id) => !fixedSet.has(id) && colVisible[id] === false),
    [filteredIds, colVisible, fixedSet],
  );

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-[2px] dark:bg-black/60"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-[60] flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface)] dark:text-[var(--suite-text)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-[var(--suite-border)]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">
              Campos y vista
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-[var(--suite-text)]">Columnas y preferencias</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-[var(--suite-border)] dark:text-[var(--suite-text-muted)] dark:hover:bg-[var(--suite-surface-input)]"
          >
            Cerrar
          </button>
        </div>

        <div className="suite-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <label className="text-[11px] font-medium text-slate-600 dark:text-[var(--suite-text-muted)]">Buscar campos</label>
            <input
              value={fieldQ}
              onChange={(e) => setFieldQ(e.target.value)}
              placeholder="Nombre de columna…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)] dark:placeholder:text-[var(--suite-text-muted)]"
            />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-400">Se muestran</p>
            <ul className="mt-2 space-y-1.5">
              {shownCols.map((id) => {
                const isFixed = fixedSet.has(id);
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-[var(--suite-border-subtle)] dark:bg-[var(--suite-surface-raised)]"
                  >
                    <span className="text-[13px] text-slate-800 dark:text-[var(--suite-text)]">{colLabels[id] ?? id}</span>
                    {isFixed ? (
                      <span
                        className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-[var(--suite-border)] dark:text-[var(--suite-text-muted)]"
                        title="Esta columna no se puede ocultar"
                      >
                        Fija
                      </span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked="true"
                        className="relative h-6 w-11 shrink-0 rounded-full bg-sky-600 transition dark:bg-sky-500"
                        onClick={() => setColVisible((o) => ({ ...o, [id]: false }))}
                      >
                        <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
                      </button>
                    )}
                  </li>
                );
              })}
              {shownCols.length === 0 ? <li className="text-xs text-slate-500">Ninguna coincidencia visible.</li> : null}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">Oculto</p>
            <ul className="mt-2 space-y-1.5">
              {hiddenCols.map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-2 py-1.5 dark:border-[var(--suite-border-subtle)]"
                >
                  <span className="text-[13px] text-slate-600 dark:text-[var(--suite-text-muted)]">{colLabels[id] ?? id}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked="false"
                    className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition dark:bg-slate-600"
                    onClick={() => setColVisible((o) => ({ ...o, [id]: true }))}
                  >
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
                  </button>
                </li>
              ))}
              {hiddenCols.length === 0 ? <li className="text-xs text-slate-500">Todo lo filtrado está visible.</li> : null}
            </ul>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-[var(--suite-text-muted)]">
            La selección se guarda en este navegador. Use «Guardar vista previa» sobre la tabla para conservar también los anchos de columna.
          </p>
        </div>
      </aside>
    </>
  );
}
