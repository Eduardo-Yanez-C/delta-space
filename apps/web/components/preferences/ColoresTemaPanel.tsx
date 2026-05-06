"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import {
  ACCENT_PALETTE_OPTIONS,
  ACCENT_PALETTE_SWATCH,
  DEFAULT_ACCENT_PALETTE_ID,
} from "../../lib/accent-palettes";
import {
  applyAccentPaletteToDocument,
  migrateGuestAccentPaletteIfNeeded,
  readStoredAccentPalette,
  writeStoredAccentPalette,
} from "../../lib/accent-theme";

export function ColoresTemaPanel() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(DEFAULT_ACCENT_PALETTE_ID);
  const [savedOk, setSavedOk] = useState<string | null>(null);

  const userId = user?.id ?? null;

  const load = useCallback(() => {
    migrateGuestAccentPaletteIfNeeded(userId);
    const id = readStoredAccentPalette(userId);
    setSelected(id);
    applyAccentPaletteToDocument(id);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = (id: string) => {
    setSelected(id);
    applyAccentPaletteToDocument(id);
    writeStoredAccentPalette(userId, id);
    setSavedOk("Tema aplicado. Se guarda en este navegador o equipo por usuario.");
    window.setTimeout(() => setSavedOk(null), 4000);
  };

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <header className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">Colores y tema</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Elija una paleta de acento para botones principales, anillos de foco, badges y bordes destacados. La
          preferencia se guarda por usuario en este equipo (almacenamiento local del navegador).
        </p>
      </header>

      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary rounded-xl px-5 py-2.5 text-sm">
            Botón principal
          </button>
          <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800 ring-1 ring-primary-500 dark:bg-slate-800 dark:text-primary-200 dark:ring-primary-400">
            Badge
          </span>
          <span className="rounded-lg border-2 border-primary-500 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-200">
            Borde acento
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ACCENT_PALETTE_OPTIONS.map((p) => {
          const on = selected === p.id;
          const sw = ACCENT_PALETTE_SWATCH[p.id] ?? { from: "#94a3b8", to: "#334155" };
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p.id)}
              className={`flex flex-col rounded-2xl border p-4 text-left transition-all ${
                on
                  ? "border-primary-500 bg-slate-100 shadow-md ring-2 ring-primary-500 dark:border-primary-500 dark:bg-slate-800/90"
                  : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-8 w-8 shrink-0 rounded-full ring-2 ring-white shadow dark:ring-slate-900"
                  style={{
                    background: `linear-gradient(135deg, ${sw.from}, ${sw.to})`,
                  }}
                  aria-hidden
                />
                <span className="font-medium text-slate-900 dark:text-slate-50">{p.label}</span>
              </span>
              <span className="mt-2 text-xs leading-snug text-slate-500 dark:text-slate-400">{p.hint}</span>
              {on ? (
                <span className="mt-3 text-xs font-semibold text-primary-700 dark:text-primary-300">Seleccionado</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        Las paletas &quot;cromáticas&quot; y complementarias usan variaciones de tono en la escala para un aspecto más
        expresivo; el contraste en componentes principales se mantiene usable.
      </p>

      {savedOk ? <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{savedOk}</p> : null}
    </div>
  );
}
