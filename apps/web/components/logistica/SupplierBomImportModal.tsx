"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  extractSupplierBomDraft,
  importSupplierBomConfirmed,
  refineSupplierBomDraftAi,
  type ExtractSupplierBomDraftResponse,
  type SupplierBomDraftLine,
  type SuiteProjectRow,
} from "../../lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  projects: SuiteProjectRow[];
  defaultProjectId: string;
  canWrite: boolean;
  onImported: () => void;
};

/** Botones IA: violeta fuerte en oscuro para distinguir del fondo. */
const iaBtn =
  "inline-flex min-h-[2.5rem] shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary-600/30 ring-1 ring-primary-400/40 transition hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 disabled:pointer-events-none disabled:opacity-50 dark:bg-violet-600 dark:shadow-violet-600/35 dark:ring-violet-300/50 dark:hover:bg-violet-500";

const iaOutlineBtn =
  "inline-flex min-h-[2.5rem] shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-violet-500 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-800 shadow-sm transition hover:bg-violet-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:pointer-events-none disabled:opacity-50 dark:border-violet-400 dark:bg-violet-600/25 dark:text-violet-100 dark:shadow-violet-900/40 dark:hover:bg-violet-600/40";

const iaPanel =
  "rounded-lg border-2 border-violet-500/45 bg-gradient-to-br from-violet-500/12 via-primary-500/8 to-indigo-600/10 p-2 shadow-sm ring-1 ring-violet-400/25 dark:border-violet-400/55 dark:from-violet-600/30 dark:via-indigo-950/40 dark:to-slate-950/80 dark:ring-violet-300/35";

const iaMetaBox =
  "rounded-md border border-violet-400/35 bg-violet-500/[0.08] px-2.5 py-1.5 text-[11px] text-slate-800 dark:border-violet-400/40 dark:bg-violet-950/50 dark:text-violet-50";

type BomColKey = "no" | "name" | "qty" | "qkit" | "kits" | "rep" | "kgu" | "kgt" | "unit" | "mat" | "act";

const BOM_COL_KEYS: BomColKey[] = ["no", "name", "qty", "qkit", "kits", "rep", "kgu", "kgt", "unit", "mat", "act"];

const DEFAULT_BOM_PREVIEW_WIDTHS: Record<BomColKey, number> = {
  no: 40,
  name: 200,
  qty: 72,
  qkit: 68,
  kits: 60,
  rep: 48,
  kgu: 70,
  kgt: 76,
  unit: 48,
  mat: 280,
  act: 72,
};

/** Controles compactos en tabla densa (sobrescribe padding/tamaño de .input-field). */
const bomCellIn =
  "input-field !h-8 !min-h-0 !rounded-md !border-slate-300/80 !px-2 !py-0.5 !text-[11px] !leading-tight shadow-none dark:!border-slate-600";
const bomCellTxt =
  "input-field !min-h-[2rem] !max-h-[4.5rem] !resize-y !rounded-md !border-slate-300/80 !px-2 !py-0.5 !text-[10px] !leading-snug shadow-none dark:!border-slate-600";

function IaSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 animate-spin ${className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-85"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function SupplierBomImportModal({ open, onClose, projects, defaultProjectId, canWrite, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftMeta, setDraftMeta] = useState<
    Pick<ExtractSupplierBomDraftResponse, "warnings" | "model" | "textCharsUsed" | "textCharsTotal" | "chunksProcessed"> | null
  >(null);
  const [lines, setLines] = useState<SupplierBomDraftLine[]>([]);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [supplierName, setSupplierName] = useState("");
  const [supplierQuoteRef, setSupplierQuoteRef] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [aiExtraInstructions, setAiExtraInstructions] = useState("");
  const [refineInstruction, setRefineInstruction] = useState("");
  /** Notas opcionales enviadas junto al archivo (solo antes/durante lectura). */
  const [readHintsOpen, setReadHintsOpen] = useState(false);
  /** Mini chat de refino: solo tras tener vista previa con filas. */
  const [refineChatOpen, setRefineChatOpen] = useState(false);
  const [bomColWidths, setBomColWidths] = useState<Record<BomColKey, number>>(() => ({ ...DEFAULT_BOM_PREVIEW_WIDTHS }));
  const bomColDragRef = useRef<{ key: BomColKey; originX: number; originW: number } | null>(null);
  const [bomColResizeActive, setBomColResizeActive] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d = defaultProjectId.trim();
    if (d) setProjectId(d);
  }, [open, defaultProjectId]);

  const reset = useCallback(() => {
    setFile(null);
    setExtracting(false);
    setRefining(false);
    setImporting(false);
    setError(null);
    setDraftMeta(null);
    setLines([]);
    setSupplierName("");
    setSupplierQuoteRef("");
    setSourceFileName("");
    setSkipDuplicates(true);
    setAiExtraInstructions("");
    setRefineInstruction("");
    setReadHintsOpen(false);
    setRefineChatOpen(false);
    setBomColWidths({ ...DEFAULT_BOM_PREVIEW_WIDTHS });
    bomColDragRef.current = null;
    setBomColResizeActive(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (lines.length === 0) setRefineChatOpen(false);
  }, [lines.length]);

  useEffect(() => {
    if (!bomColResizeActive) return;
    const move = (ev: globalThis.MouseEvent) => {
      const d = bomColDragRef.current;
      if (!d) return;
      const nw = Math.max(40, Math.min(560, d.originW + (ev.clientX - d.originX)));
      setBomColWidths((prev) => (prev[d.key] === nw ? prev : { ...prev, [d.key]: nw }));
    };
    const up = () => {
      bomColDragRef.current = null;
      setBomColResizeActive(false);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [bomColResizeActive]);

  const beginBomColResize = useCallback((e: ReactMouseEvent<HTMLButtonElement>, key: BomColKey) => {
    e.preventDefault();
    e.stopPropagation();
    bomColDragRef.current = { key, originX: e.clientX, originW: bomColWidths[key] };
    setBomColResizeActive(true);
  }, [bomColWidths]);

  const mapDraftLines = useCallback(
    (rows: SupplierBomDraftLine[]) =>
      rows.map((x) => ({
        ...x,
        qtyPerKit: x.qtyPerKit ?? null,
        unitKit: x.unitKit ?? null,
      })),
    [],
  );

  const onExtract = useCallback(async () => {
    if (!file) {
      setError("Seleccione un documento.");
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const r = await extractSupplierBomDraft(file, aiExtraInstructions || null);
      setLines(mapDraftLines(r.lines));
      setDraftMeta({
        warnings: r.warnings,
        model: r.model,
        textCharsUsed: r.textCharsUsed,
        textCharsTotal: r.textCharsTotal,
        chunksProcessed: r.chunksProcessed ?? 1,
      });
      const first = r.lines[0];
      if (first?.supplierName) setSupplierName(first.supplierName);
      if (first?.supplierQuoteRef) setSupplierQuoteRef(first.supplierQuoteRef);
      setSourceFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al extraer");
    } finally {
      setExtracting(false);
    }
  }, [file, aiExtraInstructions, mapDraftLines]);

  const onRefineWithAi = useCallback(async () => {
    const ins = refineInstruction.trim();
    if (ins.length < 4) {
      setError("Escriba al menos unas palabras de instrucción para la IA (ej. «Rellena qtyPerKit usando quantity/unitKit»).");
      return;
    }
    if (lines.length === 0) {
      setError("Primero ejecute la lectura del documento.");
      return;
    }
    setRefining(true);
    setError(null);
    try {
      const r = await refineSupplierBomDraftAi({ lines, instruction: ins });
      setLines(mapDraftLines(r.lines));
      setDraftMeta((prev) => {
        const base =
          prev ??
          ({
            warnings: [],
            model: r.model,
            textCharsUsed: 0,
            textCharsTotal: 0,
            chunksProcessed: 0,
          } as Pick<ExtractSupplierBomDraftResponse, "warnings" | "model" | "textCharsUsed" | "textCharsTotal" | "chunksProcessed">);
        return {
          ...base,
          model: r.model,
          warnings: [...base.warnings, ...r.warnings],
        };
      });
      setRefineInstruction("");
      setRefineChatOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al refinar");
    } finally {
      setRefining(false);
    }
  }, [lines, refineInstruction, mapDraftLines]);

  const removeLine = useCallback((idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateLine = useCallback((idx: number, patch: Partial<SupplierBomDraftLine>) => {
    setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }, []);

  const onConfirmImport = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) {
      setError("Indique proyecto destino.");
      return;
    }
    if (!supplierName.trim()) {
      setError("Indique nombre de proveedor.");
      return;
    }
    if (lines.length === 0) {
      setError("No hay líneas para importar.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      await importSupplierBomConfirmed({
        projectId: pid,
        supplierName: supplierName.trim(),
        supplierQuoteRef: supplierQuoteRef.trim() || null,
        sourceFileName: sourceFileName.trim() || null,
        skipDuplicates,
        lines: lines.map((l) => ({
          bomLineNo: l.bomLineNo,
          name: l.name.trim(),
          description: l.description,
          quantity: Number(l.quantity),
          unit: l.unit || "unidad",
          materialGrade: l.materialGrade,
          specText: l.specText,
          componentLabel: l.componentLabel,
          spareQty: l.spareQty,
          qtyPerKit: l.qtyPerKit,
          unitKit: l.unitKit,
          unitWeightKg: l.unitWeightKg,
          totalWeightKg: l.totalWeightKg,
        })),
      });
      onImported();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }, [lines, onClose, onImported, projectId, skipDuplicates, supplierName, supplierQuoteRef, sourceFileName]);

  const iaBusy = extracting || refining;
  const bomTableMinPx = BOM_COL_KEYS.reduce((a, k) => a + bomColWidths[k], 0);

  if (!canWrite || !open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-4" role="dialog" aria-modal aria-labelledby="bom-ai-import-title">
      <div className="flex max-h-[min(94vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b-2 border-violet-500/35 bg-gradient-to-r from-violet-600/12 via-primary-500/10 to-transparent px-3 py-2.5 dark:border-violet-400/40 dark:from-violet-600/25 dark:via-slate-900 dark:to-slate-900">
          <div className="min-w-0">
            <h2 id="bom-ai-import-title" className="text-base font-bold text-violet-900 dark:text-violet-100 sm:text-lg">
              Importar con lectura IA
            </h2>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-300">
              Tras cargar la vista previa, use el botón flotante <strong className="font-medium text-violet-700 dark:text-violet-200">IA</strong> para pedir
              ajustes a la tabla (estilo chat).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 sm:p-4">
          {error ? (
            <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
              {error}
            </div>
          ) : null}

          <div className="flex shrink-0 flex-wrap items-end gap-2">
            <label className="block min-w-0 flex-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Documento
              <input
                type="file"
                disabled={iaBusy}
                accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.tsv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
                className="mt-1 block w-full max-w-md text-sm disabled:opacity-50"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              disabled={extracting || refining || !file}
              onClick={() => void onExtract()}
              className={iaBtn}
            >
              {extracting ? (
                <>
                  <IaSpinner />
                  <span>Interpretando…</span>
                </>
              ) : (
                "Ejecutar lectura IA"
              )}
            </button>
          </div>

          <details
            className={`${iaPanel} max-w-xl`}
            open={readHintsOpen}
            onToggle={(e) => setReadHintsOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer list-none select-none text-[10px] font-bold uppercase tracking-wide text-violet-900 marker:content-none dark:text-violet-100 [&::-webkit-details-marker]:hidden">
              Notas opcionales antes de leer el archivo
            </summary>
            <div className="mt-1.5 max-h-24 overflow-y-auto border-t border-violet-400/25 pt-1.5 dark:border-violet-500/30">
              <label className="block text-[10px] text-violet-950 dark:text-violet-100">
                <span className="sr-only">Instrucciones enviadas con la lectura</span>
                <textarea
                  value={aiExtraInstructions}
                  onChange={(e) => setAiExtraInstructions(e.target.value)}
                  disabled={iaBusy}
                  rows={2}
                  maxLength={3000}
                  className="mt-0.5 w-full resize-none rounded border border-violet-400/50 bg-white/95 px-2 py-1 text-[11px] text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-violet-400/60 dark:bg-slate-950/90 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="Opcional: mapeo de columnas, etc."
                />
              </label>
            </div>
          </details>

          {draftMeta ? (
            <div className={`shrink-0 ${iaMetaBox}`}>
              <p className="leading-snug">
                <span className="font-mono text-violet-900 dark:text-violet-200">{draftMeta.model}</span>
                <span className="text-slate-600 dark:text-slate-300"> · {draftMeta.chunksProcessed} fragmentos · </span>
                <span className="text-slate-600 dark:text-slate-300">{draftMeta.textCharsTotal.toLocaleString("es-CL")} car. texto</span>
              </p>
              {draftMeta.warnings.length > 0 ? (
                <ul className="mt-1 max-h-16 list-inside list-disc overflow-y-auto text-amber-950 dark:text-amber-100/95">
                  {draftMeta.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="grid shrink-0 gap-2 sm:grid-cols-2">
            <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
              Proyecto destino *
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="input-field mt-1 w-full text-sm"
              >
                <option value="">— Seleccione —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
              Proveedor *
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="input-field mt-1 w-full text-sm"
                placeholder="Ej. Mibet"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
              Ref. cotización
              <input
                value={supplierQuoteRef}
                onChange={(e) => setSupplierQuoteRef(e.target.value)}
                className="input-field mt-1 w-full text-sm"
                placeholder="Ej. PJ-251029-06"
              />
            </label>
            <label className="flex items-center gap-2 pt-5 text-xs text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
              Omitir duplicados (mismo proyecto, ref. + nº BOM)
            </label>
          </div>

          {lines.length > 0 ? (
            <div className="relative flex min-h-[200px] flex-1 flex-col overflow-hidden">
              <p className="mb-1 shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                Vista previa ({lines.length} filas) — columnas redimensionables. Pulse <strong className="text-violet-600 dark:text-violet-300">IA</strong> abajo a
                la derecha para pedir cambios a la tabla.
              </p>
              <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 pb-20 pr-1 dark:border-slate-600">
                <table className="table-fixed border-collapse text-left text-[11px] leading-tight" style={{ width: `max(100%, ${bomTableMinPx}px)` }}>
                  <colgroup>
                    {BOM_COL_KEYS.map((k) => (
                      <col key={k} style={{ width: bomColWidths[k] }} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/95 text-[10px] uppercase shadow-sm backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/95">
                    <tr className="text-slate-600 dark:text-slate-200">
                      {(
                        [
                          ["no", "#"],
                          ["name", "Nombre"],
                          ["qty", "Tot.qty"],
                          ["qkit", "Q/kit"],
                          ["kits", "Kits"],
                          ["rep", "Rep."],
                          ["kgu", "kg/u"],
                          ["kgt", "kg tot"],
                          ["unit", "Un."],
                          ["mat", "Material / espec."],
                          ["act", ""],
                        ] as const
                      ).map(([key, label], idx) => {
                        const k = key as BomColKey;
                        const showHandle = idx < BOM_COL_KEYS.length - 1;
                        return (
                          <th key={k} className="group/th relative !p-0 font-semibold tracking-wide">
                            <div className="flex min-h-[2rem] items-stretch">
                              <div className="min-w-0 flex-1 px-1.5 py-1.5">{label}</div>
                              {showHandle ? (
                                <button
                                  type="button"
                                  aria-label={`Ancho columna ${label || "acción"}`}
                                  title="Arrastrar para ancho"
                                  className="flex w-[9px] shrink-0 cursor-col-resize touch-none select-none items-center justify-center border-l border-slate-300/90 bg-transparent hover:bg-violet-500/15 dark:border-slate-500 dark:hover:bg-violet-400/20"
                                  onMouseDown={(e) => beginBomColResize(e, k)}
                                >
                                  <span className="pointer-events-none h-3 w-px rounded-full bg-violet-500/70 dark:bg-violet-300/80" />
                                </button>
                              ) : null}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900">
                    {lines.map((row, idx) => (
                      <tr key={`${row.bomLineNo ?? "x"}-${idx}`} className="border-b border-slate-100 align-middle dark:border-slate-800">
                        <td className="whitespace-nowrap px-1 py-0.5 tabular-nums text-slate-600 dark:text-slate-400">{row.bomLineNo ?? "—"}</td>
                        <td className="px-1 py-0.5 align-middle">
                          <input
                            type="text"
                            className={`${bomCellIn} w-full min-w-0`}
                            title={row.name}
                            value={row.name}
                            onChange={(e) => updateLine(idx, { name: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-middle">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            className={`${bomCellIn} w-full min-w-0 text-right tabular-nums`}
                            value={row.quantity}
                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-middle">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            className={`${bomCellIn} w-full min-w-0 text-right tabular-nums`}
                            value={row.qtyPerKit ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateLine(idx, { qtyPerKit: v === "" ? null : Number(v) });
                            }}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-middle">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            className={`${bomCellIn} w-full min-w-0 text-right tabular-nums`}
                            value={row.unitKit ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateLine(idx, { unitKit: v === "" ? null : Number(v) });
                            }}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-middle">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            className={`${bomCellIn} w-full min-w-0 text-right tabular-nums`}
                            value={row.spareQty ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateLine(idx, { spareQty: v === "" ? null : Number(v) });
                            }}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-middle">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            className={`${bomCellIn} w-full min-w-0 text-right tabular-nums`}
                            value={row.unitWeightKg ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateLine(idx, { unitWeightKg: v === "" ? null : Number(v) });
                            }}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-middle">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            className={`${bomCellIn} w-full min-w-0 text-right tabular-nums`}
                            value={row.totalWeightKg ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateLine(idx, { totalWeightKg: v === "" ? null : Number(v) });
                            }}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-middle">
                          <input
                            className={`${bomCellIn} w-full min-w-0`}
                            value={row.unit}
                            onChange={(e) => updateLine(idx, { unit: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-0.5 align-top">
                          <div className="grid min-w-0 grid-cols-2 gap-x-1 gap-y-0.5">
                            <input
                              className={`${bomCellIn} min-w-0`}
                              placeholder="Material"
                              value={row.materialGrade ?? ""}
                              onChange={(e) => updateLine(idx, { materialGrade: e.target.value.trim() || null })}
                            />
                            <input
                              className={`${bomCellIn} min-w-0`}
                              placeholder="Etiqueta"
                              value={row.componentLabel ?? ""}
                              onChange={(e) => updateLine(idx, { componentLabel: e.target.value.trim() || null })}
                            />
                            <textarea
                              className={`${bomCellTxt} col-span-2 w-full`}
                              rows={1}
                              placeholder="Especificación"
                              value={row.specText ?? ""}
                              onChange={(e) => updateLine(idx, { specText: e.target.value.trim() || null })}
                            />
                          </div>
                        </td>
                        <td className="px-1 py-0.5 align-middle">
                          <div className="flex min-h-8 items-center justify-end">
                            <button
                              type="button"
                              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                              onClick={() => removeLine(idx)}
                            >
                              Quitar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pointer-events-none absolute bottom-1 right-1 z-30 flex flex-col items-end">
                <div className="pointer-events-auto flex flex-col items-end gap-2">
                  {refineChatOpen ? (
                    <div
                      className="w-[17.5rem] max-w-[min(100%,calc(100vw-2rem))] rounded-xl border-2 border-violet-500/55 bg-white p-2 shadow-2xl dark:border-violet-400/50 dark:bg-slate-900 dark:shadow-violet-950/50"
                      role="dialog"
                      aria-label="Instrucciones IA sobre la vista previa"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-violet-200/90 pb-1.5 dark:border-violet-700/70">
                        <span className="text-[11px] font-bold tracking-wide text-violet-800 dark:text-violet-100">IA · tabla</span>
                        <button
                          type="button"
                          className="rounded-md px-2 py-0.5 text-base leading-none text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                          onClick={() => setRefineChatOpen(false)}
                          aria-label="Cerrar chat IA"
                        >
                          ×
                        </button>
                      </div>
                      <p className="mt-1 text-[9px] leading-snug text-slate-500 dark:text-slate-400">
                        Describa qué corregir (ej. rellenar Q/kit, unificar unidades…). Se aplica a todas las filas visibles.
                      </p>
                      <textarea
                        value={refineInstruction}
                        onChange={(e) => setRefineInstruction(e.target.value)}
                        disabled={refining}
                        rows={3}
                        maxLength={4000}
                        className="mt-1 w-full resize-none rounded-md border border-violet-400/55 bg-slate-50/90 px-2 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-violet-500/50 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                        placeholder="Ej.: Rellena qtyPerKit usando quantity y unitKit…"
                      />
                      <button
                        type="button"
                        disabled={refining || extracting || refineInstruction.trim().length < 4}
                        onClick={() => void onRefineWithAi()}
                        className={`${iaOutlineBtn} mt-1.5 w-full min-h-0 py-2 text-xs`}
                      >
                        {refining ? (
                          <>
                            <IaSpinner />
                            <span>Aplicando…</span>
                          </>
                        ) : (
                          "Aplicar a la vista previa"
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRefineChatOpen(true)}
                      className={`${iaBtn} h-10 w-10 min-h-0 rounded-full p-0 text-xs font-bold shadow-lg`}
                      title="Abrir SAM sobre la tabla"
                      aria-label="Abrir SAM sobre la tabla"
                    >
                      IA
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/80">
          <button
            type="button"
            onClick={() => onClose()}
            disabled={importing}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-slate-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={importing || lines.length === 0 || iaBusy}
            onClick={() => void onConfirmImport()}
            className={`${iaBtn} min-w-[11rem]`}
          >
            {importing ? (
              <>
                <IaSpinner />
                <span>Guardando…</span>
              </>
            ) : (
              `Confirmar ${lines.length} línea(s)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
