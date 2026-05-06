"use client";
import type { ReactNode } from "react";

export function OrgCanvasToolbar({
  scalePercent,
  onZoomIn,
  onZoomOut,
  onFit,
  onCenter,
  onResetZoom,
  onCreateNode,
  onOpenList,
  labels,
  trailingSlot,
  linesToolbar,
}: {
  scalePercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onCenter: () => void;
  onResetZoom: () => void;
  onCreateNode: () => void;
  onOpenList: () => void;
  labels: {
    zoomIn: string;
    zoomOut: string;
    fit: string;
    center: string;
    reset: string;
    create: string;
    listView: string;
    helpTitle: string;
    helpBody: string;
  };
  /** Acciones contextuales (p. ej. subordinado bajo nodo seleccionado). */
  trailingSlot?: ReactNode;
  /** Botón compacto para estilos de línea / conexiones (modal). */
  linesToolbar?: { label: string; title?: string; onClick: () => void } | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] px-2 py-1 sm:px-2.5 sm:py-1.5">
      <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
        <button type="button" className="pmo-btn-secondary px-1.5 py-0.5 text-[11px] font-bold sm:px-2 sm:py-1 sm:text-xs" onClick={onZoomOut} title={labels.zoomOut}>
          −
        </button>
        <button type="button" className="pmo-btn-secondary px-1.5 py-0.5 text-[11px] font-bold sm:px-2 sm:py-1 sm:text-xs" onClick={onZoomIn} title={labels.zoomIn}>
          +
        </button>
        <span className="min-w-[2.75rem] text-center font-mono text-[10px] font-semibold text-[var(--pmo-text)] sm:min-w-[3rem] sm:text-[11px]">{scalePercent}%</span>
        <button type="button" className="pmo-btn-secondary px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-[11px]" onClick={onResetZoom}>
          {labels.reset}
        </button>
        <button type="button" className="pmo-btn-secondary px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-[11px]" onClick={onFit}>
          {labels.fit}
        </button>
        <button type="button" className="pmo-btn-secondary px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-[11px]" onClick={onCenter}>
          {labels.center}
        </button>
      </div>
      <div className="mx-0.5 hidden h-5 w-px bg-[var(--pmo-border)] sm:mx-1 sm:block sm:h-6" aria-hidden />
      <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
        <button type="button" className="pmo-btn-primary px-2 py-0.5 text-[10px] font-bold sm:px-2.5 sm:py-1 sm:text-[11px]" onClick={onCreateNode}>
          {labels.create}
        </button>
        <button type="button" className="pmo-btn-ghost border border-[var(--pmo-border)] px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-[11px]" onClick={onOpenList}>
          {labels.listView}
        </button>
        {linesToolbar ? (
          <button
            type="button"
            className="rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--pmo-text)] hover:bg-[var(--pmo-row-hover)] sm:px-2 sm:py-1 sm:text-[11px]"
            title={linesToolbar.title ?? linesToolbar.label}
            onClick={linesToolbar.onClick}
          >
            {linesToolbar.label}
          </button>
        ) : null}
        <details className="relative">
          <summary className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--pmo-border)] text-[10px] font-bold text-[var(--pmo-text-muted)] marker:hidden hover:bg-[var(--pmo-row-hover)] sm:h-7 sm:w-7 sm:text-xs [&::-webkit-details-marker]:hidden">
            ?
          </summary>
          <div className="absolute right-0 z-50 mt-1 max-w-[min(92vw,320px)] rounded-lg border border-[var(--pmo-border)] bg-[var(--pmo-surface)] p-3 text-[11px] leading-snug text-[var(--pmo-text)] shadow-xl">
            <p className="font-bold text-[var(--pmo-text)]">{labels.helpTitle}</p>
            <p className="mt-1 text-[var(--pmo-text-muted)]">{labels.helpBody}</p>
          </div>
        </details>
        {trailingSlot ? <div className="flex flex-wrap items-center gap-1 border-l border-[var(--pmo-border)] pl-2">{trailingSlot}</div> : null}
      </div>
    </div>
  );
}
