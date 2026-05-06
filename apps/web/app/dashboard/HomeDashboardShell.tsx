"use client";

import { useCallback, useEffect, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useAuth } from "../../lib/auth-context";
import {
  DEFAULT_HOME_DASHBOARD,
  HOME_DASHBOARD_SCHEMA_VERSION,
  WIDGET_CATALOG,
  canAddAnotherWidget,
  countWidgetsByType,
  newWidgetInstance,
  parsePersistedHomeDashboard,
  storageKeyForUser,
  type HomeDashboardWidgetInstance,
  type HomeWidgetType,
} from "../../lib/home-dashboard";
import { renderHomeWidget, type HomeWidgetRenderContext } from "./home-dashboard-widgets";

const GridLayoutWithWidth = WidthProvider(GridLayout);

export type HomeDashboardShellProps = HomeWidgetRenderContext;

export function HomeDashboardShell(ctx: HomeDashboardShellProps) {
  const { user } = useAuth();
  const storageKey = storageKeyForUser(user?.id);

  const [editMode, setEditMode] = useState(false);
  const [widgets, setWidgets] = useState<HomeDashboardWidgetInstance[]>(DEFAULT_HOME_DASHBOARD.widgets);
  const [layout, setLayout] = useState<Layout[]>(DEFAULT_HOME_DASHBOARD.layout);
  const [hydrated, setHydrated] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    const parsed = parsePersistedHomeDashboard(raw);
    if (parsed) {
      setWidgets(parsed.widgets);
      setLayout(parsed.layout);
    } else {
      setWidgets(DEFAULT_HOME_DASHBOARD.widgets);
      setLayout(DEFAULT_HOME_DASHBOARD.layout);
    }
    setHydrated(true);
  }, [storageKey]);

  const markDirty = useCallback(() => {
    if (editMode) setDirty(true);
  }, [editMode]);

  const onLayoutChange = useCallback(
    (next: Layout[]) => {
      setLayout(next);
    },
    [],
  );

  const handleSave = useCallback(() => {
    const payload = { v: HOME_DASHBOARD_SCHEMA_VERSION, widgets, layout };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    }
    setDirty(false);
    setSaveFlash(true);
    window.setTimeout(() => setSaveFlash(false), 2200);
  }, [storageKey, widgets, layout]);

  const handleReset = useCallback(() => {
    setWidgets(DEFAULT_HOME_DASHBOARD.widgets);
    setLayout(DEFAULT_HOME_DASHBOARD.layout);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setDirty(false);
  }, [storageKey]);

  const removeWidget = useCallback((i: string) => {
    setWidgets((w) => w.filter((x) => x.i !== i));
    setLayout((l) => l.filter((x) => x.i !== i));
    markDirty();
  }, [markDirty]);

  const addWidget = useCallback(
    (type: HomeWidgetType) => {
      let added = false;
      setWidgets((current) => {
        if (!canAddAnotherWidget(current, type)) return current;
        added = true;
        const { widget, layout: item } = newWidgetInstance(type);
        setLayout((l) => [...l, item]);
        return [...current, widget];
      });
      if (added) {
        setAddOpen(false);
        markDirty();
      }
    },
    [markDirty],
  );

  const toggleEdit = useCallback(() => {
    setEditMode((e) => !e);
    setAddOpen(false);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80">
        <div className="min-w-0 flex-1 border-l-[3px] border-l-primary-500 pl-2.5">
          <h2 className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">Inicio</h2>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
            Tablero personalizable: organice tarjetas, guarde su vista y acceda al flujo comercial.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto sm:justify-end">
          {editMode && (
            <>
              <button
                type="button"
                onClick={() => setAddOpen((o) => !o)}
                className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
              >
                Agregar tarjeta
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md border border-emerald-600/80 bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600"
              >
                Guardar vista
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/80"
              >
                Restablecer vista
              </button>
              {dirty && (
                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">Cambios sin guardar</span>
              )}
              {saveFlash && (
                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Vista guardada</span>
              )}
            </>
          )}
          <button
            type="button"
            onClick={toggleEdit}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              editMode
                ? "border-primary-600 bg-primary-600 text-white dark:border-primary-500 dark:bg-primary-600"
                : "border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80"
            }`}
          >
            {editMode ? "Salir de personalización" : "Personalizar"}
          </button>
        </div>
      </div>

      {editMode && addOpen && (
        <div className="max-h-72 overflow-auto rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Catálogo de tarjetas</p>
          <p className="mb-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            Las tarjetas únicas muestran <span className="font-medium text-slate-600 dark:text-slate-300">En tablero</span> y no se pueden duplicar.
            Las que admiten varias instancias indican <span className="font-medium text-sky-700 dark:text-sky-300">Varias permitidas</span>.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {WIDGET_CATALOG.map((entry) => {
              const count = countWidgetsByType(widgets, entry.type);
              const canAdd = canAddAnotherWidget(widgets, entry.type);
              const onBoard = count > 0;
              return (
                <li key={entry.type}>
                  <button
                    type="button"
                    disabled={!canAdd}
                    onClick={() => addWidget(entry.type)}
                    className={`w-full rounded-md border px-2 py-2 text-left text-xs transition-colors ${
                      canAdd
                        ? "border-slate-200/90 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                        : "cursor-not-allowed border-slate-200/60 bg-slate-50/80 opacity-70 dark:border-slate-700 dark:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{entry.label}</span>
                      {entry.allowMultiple ? (
                        <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
                          Varias
                        </span>
                      ) : onBoard ? (
                        <span className="shrink-0 rounded bg-slate-200/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-600 dark:text-slate-100">
                          En tablero
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">{entry.description}</span>
                    {entry.allowMultiple && count > 0 && (
                      <span className="mt-1 block text-[10px] font-medium text-slate-600 dark:text-slate-300">
                        {count} en tablero — puede agregar otra
                      </span>
                    )}
                    {!entry.allowMultiple && onBoard && (
                      <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">Ya agregada; quite la actual para volver a añadirla.</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!hydrated ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Cargando tablero…
        </div>
      ) : (
        <GridLayoutWithWidth
          className="min-h-[120px]"
          layout={layout}
          cols={12}
          rowHeight={28}
          margin={[10, 10]}
          containerPadding={[0, 0]}
          onLayoutChange={onLayoutChange}
          onDragStop={markDirty}
          onResizeStop={markDirty}
          isDraggable={editMode}
          isResizable={editMode}
          compactType="vertical"
          preventCollision={false}
          draggableCancel="button,a,input,textarea,select,[data-rgl-no-drag]"
        >
          {widgets.map((w) => (
            <div key={w.i} className="min-h-0">
              <div className="relative h-full min-h-[48px]">
                {editMode && (
                  <button
                    type="button"
                    data-rgl-no-drag
                    onClick={() => removeWidget(w.i)}
                    className="absolute right-1 top-1 z-[2] flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                    aria-label="Quitar tarjeta del tablero"
                  >
                    ×
                  </button>
                )}
                {renderHomeWidget(w.type, ctx, editMode)}
              </div>
            </div>
          ))}
        </GridLayoutWithWidth>
      )}

      {editMode && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          Arrastre el borde inferior derecho para redimensionar. La vista se guarda en este navegador por usuario (MVP); más adelante se puede sincronizar con el servidor.
        </p>
      )}
    </div>
  );
}
