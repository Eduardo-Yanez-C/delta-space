"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { updateSuiteProject } from "../../lib/api";
import {
  type TaskStatusCategory,
  type TaskStatusConfig,
  type TaskStatusDef,
  sortStatusDefs,
} from "../../lib/suite-task-status-config";
import {
  DEFAULT_LOGISTICS_TRANSPORT_STATUS_CONFIG,
  normalizeLogisticsTransportStatusConfig,
} from "../../lib/suite-logistics-transport-status-config";

const SECTIONS: {
  category: TaskStatusCategory;
  title: string;
  hint: string;
}[] = [
  {
    category: "not_started",
    title: "No iniciado",
    hint: "Pendiente de programar / retiro",
  },
  { category: "active", title: "En curso", hint: "En ruta o en destino" },
  { category: "done", title: "Hecho", hint: "Cerrado / entregado" },
];

function genId() {
  return `lt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function LogisticsTransportStatusesModal({
  open,
  onClose,
  projectId,
  initialRaw,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  initialRaw: unknown;
  onSaved: () => void;
}) {
  const [cfg, setCfg] = useState<TaskStatusConfig>(
    DEFAULT_LOGISTICS_TRANSPORT_STATUS_CONFIG,
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCfg(normalizeLogisticsTransportStatusConfig(initialRaw));
    setErr(null);
  }, [open, initialRaw]);

  const byCategory = useCallback(
    (cat: TaskStatusCategory) =>
      sortStatusDefs(cfg.statuses.filter((s) => s.category === cat)),
    [cfg.statuses],
  );

  const byCategoryIdList = useMemo(() => {
    const out: Record<TaskStatusCategory, string[]> = {
      not_started: [],
      active: [],
      done: [],
    };
    for (const cat of Object.keys(out) as TaskStatusCategory[]) {
      out[cat] = byCategory(cat).map((s) => s.id);
    }
    return out;
  }, [byCategory]);

  const reorderWithinCategory = useCallback(
    (category: TaskStatusCategory, fromId: string, toId: string) => {
      if (!fromId || !toId || fromId === toId) return;
      const ordered = byCategory(category);
      const fromIdx = ordered.findIndex((s) => s.id === fromId);
      const toIdx = ordered.findIndex((s) => s.id === toId);
      if (fromIdx < 0 || toIdx < 0) return;
      const next = [...ordered];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const normalized = next.map((s, i) => ({ ...s, order: i }));
      const normalizedIds = new Set(normalized.map((s) => s.id));
      setCfg((c) => ({
        ...c,
        statuses: c.statuses.map((s) =>
          normalizedIds.has(s.id) ? normalized.find((x) => x.id === s.id)! : s,
        ),
      }));
    },
    [byCategory],
  );

  const moveOne = useCallback(
    (category: TaskStatusCategory, id: string, dir: -1 | 1) => {
      const ids = byCategoryIdList[category];
      const idx = ids.indexOf(id);
      if (idx < 0) return;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= ids.length) return;
      reorderWithinCategory(category, id, ids[nextIdx]!);
    },
    [byCategoryIdList, reorderWithinCategory],
  );

  const updateStatus = useCallback(
    (id: string, patch: Partial<TaskStatusDef>) => {
      setCfg((c) => ({
        ...c,
        statuses: c.statuses.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));
    },
    [],
  );

  const removeStatus = useCallback((id: string) => {
    setCfg((c) => ({ ...c, statuses: c.statuses.filter((s) => s.id !== id) }));
  }, []);

  const addStatus = useCallback((category: TaskStatusCategory) => {
    setCfg((c) => {
      const id = genId();
      const n = c.statuses.filter((s) => s.category === category).length;
      return {
        ...c,
        statuses: [
          ...c.statuses,
          { id, label: "Nuevo estado", category, order: n },
        ],
      };
    });
  }, []);

  const save = useCallback(async () => {
    if (cfg.statuses.length < 1) {
      setErr("Debe existir al menos un estado.");
      return;
    }
    const ids = new Set(cfg.statuses.map((s) => s.id));
    if (ids.size !== cfg.statuses.length) {
      setErr("Los identificadores de estado deben ser únicos.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await updateSuiteProject(projectId, {
        logisticsTransportStatusConfig: cfg as unknown as Record<
          string,
          unknown
        >,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [cfg, projectId, onSaved, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-[75] w-[min(100vw-24px,520px)] max-h-[min(90vh,720px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Estados de transporte
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Mismo criterio que las tareas: categorías y etiquetas. Se guardan
              en el proyecto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="suite-scroll max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-4 py-4">
          {err ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950 dark:text-rose-200">
              {err}
            </p>
          ) : null}

          {SECTIONS.map((sec) => (
            <section key={sec.category}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    {sec.title}
                  </p>
                  <p className="text-[10px] text-slate-500">{sec.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addStatus(sec.category)}
                  className="rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-900"
                >
                  + Estado
                </button>
              </div>
              <ul className="mt-2 space-y-2">
                {byCategory(sec.category).map((s) => (
                  <li
                    key={s.id}
                    draggable
                    onDragStart={() => {
                      setDraggingId(s.id);
                      setDragOverId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverId(s.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!draggingId) return;
                      reorderWithinCategory(sec.category, draggingId, s.id);
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 px-2 py-2 dark:bg-slate-900/60 ${
                      dragOverId === s.id && draggingId && draggingId !== s.id
                        ? "border-primary-400/60 ring-2 ring-primary-400/20 dark:border-primary-500/60"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span
                      className="cursor-grab select-none rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-bold text-slate-400 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-950"
                      title="Arrastre para reordenar"
                      aria-label="Arrastrar"
                    >
                      ⋮⋮
                    </span>
                    <input
                      value={s.label}
                      onChange={(e) =>
                        updateStatus(s.id, { label: e.target.value })
                      }
                      className="min-w-[120px] flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Subir"
                        onClick={() => moveOne(sec.category, s.id, -1)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title="Bajar"
                        onClick={() => moveOne(sec.category, s.id, 1)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStatus(s.id)}
                      className="text-xs text-rose-600 hover:underline"
                      disabled={cfg.statuses.length <= 1}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
                {byCategory(sec.category).length === 0 ? (
                  <li className="text-xs italic text-slate-500">
                    Sin estados en esta categoría.
                  </li>
                ) : null}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 dark:bg-primary-500"
          >
            {saving ? "Guardando…" : "Aplicar cambios"}
          </button>
        </div>
      </div>
    </>
  );
}
