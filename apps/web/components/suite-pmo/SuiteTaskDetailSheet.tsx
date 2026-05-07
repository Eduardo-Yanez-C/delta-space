"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PatchSuiteTaskInput, SuiteTaskCustomFieldRow, SuiteTaskRow, User } from "../../lib/api";
import { fetchAssignableSalesUsers, patchSuiteTask } from "../../lib/api";
import { formatIsoDateDDMMAAAA } from "../../lib/suite-format-plan-date";
import type { TaskStatusConfig } from "../../lib/suite-task-status-config";
import { statusPillFromConfig } from "../../lib/suite-task-status-config";
import { SuiteActivityComposer } from "./SuiteActivityComposer";

/** Superficies estilo ClickUp (modo oscuro): carbón, bordes sutiles, texto alto contraste. */
const cu = {
  shell: "bg-[#111111] text-[#ececec]",
  panel: "bg-[#0d0d0d]",
  border: "border-[#2e2e2e]",
  muted: "text-[#9b9b9b]",
  label: "text-[#8f8f8f]",
  input:
    "rounded-lg border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2 text-sm text-[#ececec] placeholder:text-[#666] focus:border-[#5c5c5c] focus:outline-none focus:ring-1 focus:ring-[#5c5c5c]",
  /** Evita la franja / flechas claras del `type=number` en modo oscuro (WebKit + Firefox). */
  inputNumber:
    "[color-scheme:dark] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
  btnGhost: "rounded-lg border border-[#3d3d3d] px-3 py-2 text-sm text-[#ececec] hover:bg-[#252525]",
  btnPrimary:
    "rounded-lg bg-[var(--suite-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--suite-accent-hover)]",
};

type FieldTypeItem = { id: string; label: string; section: "ai" | "all"; swatch: string };

/** Listado demo inspirado en ClickUp (tipos de campo + búsqueda). */
const FIELD_TYPE_ITEMS: FieldTypeItem[] = [
  { id: "ai-summary", label: "Resumen", section: "ai", swatch: "bg-violet-500" },
  { id: "ai-text", label: "Texto personalizado", section: "ai", swatch: "bg-violet-400" },
  { id: "ai-dropdown", label: "Menú desplegable personalizado", section: "ai", swatch: "bg-purple-500" },
  { id: "dropdown", label: "Lista desplegable", section: "all", swatch: "bg-emerald-500" },
  { id: "text", label: "Texto", section: "all", swatch: "bg-sky-500" },
  { id: "date", label: "Fecha", section: "all", swatch: "bg-orange-500" },
  { id: "textarea", label: "Área de texto", section: "all", swatch: "bg-blue-500" },
  { id: "number", label: "Número", section: "all", swatch: "bg-teal-500" },
  { id: "tags", label: "Etiquetas", section: "all", swatch: "bg-lime-500" },
  { id: "checkbox", label: "Casilla de selección", section: "all", swatch: "bg-pink-500" },
  { id: "money", label: "Dinero", section: "all", swatch: "bg-emerald-600" },
  { id: "url", label: "Sitio web", section: "all", swatch: "bg-red-500" },
  { id: "formula", label: "Fórmula", section: "all", swatch: "bg-cyan-600" },
  { id: "relation", label: "Relación", section: "all", swatch: "bg-blue-600" },
  { id: "people", label: "Personas", section: "all", swatch: "bg-rose-500" },
  { id: "progress-auto", label: "Progreso (automático)", section: "all", swatch: "bg-amber-500" },
  { id: "email", label: "Correo electrónico", section: "all", swatch: "bg-red-400" },
  { id: "phone", label: "Teléfono", section: "all", swatch: "bg-pink-400" },
  { id: "files", label: "Archivos", section: "all", swatch: "bg-violet-600" },
  { id: "location", label: "Ubicación", section: "all", swatch: "bg-green-600" },
  { id: "rating", label: "Calificación", section: "all", swatch: "bg-yellow-500" },
  { id: "vote", label: "Votación", section: "all", swatch: "bg-indigo-500" },
  { id: "signature", label: "Firma", section: "all", swatch: "bg-stone-500" },
  { id: "button", label: "Botón", section: "all", swatch: "bg-slate-500" },
  { id: "tasks", label: "Tareas", section: "all", swatch: "bg-fuchsia-500" },
  { id: "translation", label: "Traducción", section: "all", swatch: "bg-cyan-500" },
  { id: "sentiment", label: "Sentimiento", section: "all", swatch: "bg-amber-400" },
  { id: "shirt", label: "Talla de camiseta", section: "all", swatch: "bg-orange-400" },
];

const SUITE_FIELD_CONTEXT_ID = "suite-field-context";
/** Persistidos en customFields; editados también en la columna meta (no duplicar en «Campos»). */
const SUITE_FIELD_STORY_POINTS = "suite:story-points";
const SUITE_FIELD_LABELS = "suite:labels";

const HIDDEN_IN_FIELDS_PANEL = new Set([SUITE_FIELD_STORY_POINTS, SUITE_FIELD_LABELS]);

const PRIORITY_MENU_IDS = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;

function priorityMatchesMenu(p: string, id: (typeof PRIORITY_MENU_IDS)[number]): boolean {
  const u = (p || "").toUpperCase();
  if (id === "URGENT") return u === "URGENT" || u === "URGENTE";
  if (id === "HIGH") return u === "HIGH" || u === "ALTA";
  if (id === "LOW") return u === "LOW" || u === "BAJA";
  return u === "NORMAL" || u === "" || u === "MEDIUM";
}

function ensurePlanningSidebarFields(rows: SuiteTaskCustomFieldRow[]): SuiteTaskCustomFieldRow[] {
  const out = [...rows];
  if (!out.some((r) => r.id === SUITE_FIELD_STORY_POINTS)) {
    out.push({ id: SUITE_FIELD_STORY_POINTS, type: "number", label: "Puntos de sprint", value: "", required: false });
  }
  if (!out.some((r) => r.id === SUITE_FIELD_LABELS)) {
    out.push({ id: SUITE_FIELD_LABELS, type: "text", label: "Etiquetas", value: "", required: false });
  }
  return out;
}

function parseClientCustomFields(raw: unknown): SuiteTaskCustomFieldRow[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      return parseClientCustomFields(JSON.parse(s) as unknown);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: SuiteTaskCustomFieldRow[] = [];
  for (let i = 0; i < Math.min(raw.length, 40); i++) {
    const o = raw[i];
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    out.push({
      id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : `fld_${i}`,
      type: typeof r.type === "string" && r.type.trim() ? r.type.trim() : "text",
      label: typeof r.label === "string" && r.label.trim() ? r.label.trim() : "Campo",
      value: r.value == null ? "" : String(r.value),
      required: Boolean(r.required),
    });
  }
  return out;
}

function initialFieldsFromTask(task: SuiteTaskRow): SuiteTaskCustomFieldRow[] {
  const rows = parseClientCustomFields(task.customFields);
  if (rows.length === 0) {
    return ensurePlanningSidebarFields([
      {
        id: SUITE_FIELD_CONTEXT_ID,
        type: "textarea",
        label: "Comentario",
        value: task.contextNote ?? "",
        required: false,
      },
    ]);
  }
  const hasBuiltin = rows.some((r) => r.id === SUITE_FIELD_CONTEXT_ID);
  if (!hasBuiltin) {
    return ensurePlanningSidebarFields([
      {
        id: SUITE_FIELD_CONTEXT_ID,
        type: "textarea",
        label: "Comentario",
        value: task.contextNote ?? "",
        required: false,
      },
      ...rows,
    ]);
  }
  return ensurePlanningSidebarFields(
    rows.map((r) =>
      r.id === SUITE_FIELD_CONTEXT_ID
        ? {
            ...r,
            value:
              task.contextNote != null && String(task.contextNote).trim() !== ""
                ? String(task.contextNote)
                : r.value,
          }
        : r,
    ),
  );
}

function menuItemToNewField(item: FieldTypeItem): SuiteTaskCustomFieldRow {
  const storageType = item.section === "ai" ? (item.id === "ai-dropdown" ? "dropdown" : "text") : item.id;
  return {
    id: crypto.randomUUID(),
    type: storageType,
    label: item.label,
    value: "",
    required: false,
  };
}

function glyphIdForStorageType(t: string): string {
  const known = new Set(FIELD_TYPE_ITEMS.map((x) => x.id));
  if (known.has(t)) return t;
  if (t === "textarea") return "textarea";
  return "text";
}

function IconBox({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a1d24] text-[#8eb7ff] ring-1 ring-[#2e3544] [&>svg]:h-[18px] [&>svg]:w-[18px]">
      {children}
    </span>
  );
}

/** Icono blanco dentro del cuadrado de color (menú + tipos de campo). */
function FieldGlyph({ id }: { id: string }) {
  const g = "h-3.5 w-3.5 shrink-0 text-white";
  switch (id) {
    case "ai-summary":
    case "ai-text":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12h6M12 9v6" strokeLinecap="round" />
          <path d="M4 6h16v12H4z" strokeLinejoin="round" />
        </svg>
      );
    case "ai-dropdown":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 14l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "dropdown":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h10M4 17h14" strokeLinecap="round" />
          <path d="M18 10l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "text":
      return (
        <svg className={g} viewBox="0 0 24 24">
          <text x="12" y="16" textAnchor="middle" fill="white" style={{ fontSize: "13px", fontWeight: 700 }}>
            T
          </text>
        </svg>
      );
    case "date":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
        </svg>
      );
    case "textarea":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16v12H4z" strokeLinejoin="round" />
          <path d="M8 10h8M8 14h5" strokeLinecap="round" />
        </svg>
      );
    case "number":
      return (
        <svg className={g} viewBox="0 0 24 24">
          <text x="12" y="16" textAnchor="middle" fill="white" style={{ fontSize: "12px", fontWeight: 800 }}>
            #
          </text>
        </svg>
      );
    case "tags":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 10V4h6l12 12-6 6L4 10z" strokeLinejoin="round" />
        </svg>
      );
    case "checkbox":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "money":
      return (
        <svg className={g} viewBox="0 0 24 24">
          <text x="12" y="16" textAnchor="middle" fill="white" style={{ fontSize: "13px", fontWeight: 700 }}>
            $
          </text>
        </svg>
      );
    case "url":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 000 18" strokeLinecap="round" />
        </svg>
      );
    case "formula":
      return (
        <svg className={g} viewBox="0 0 24 24">
          <text x="12" y="16" textAnchor="middle" fill="white" style={{ fontSize: "11px", fontWeight: 700 }}>
            fx
          </text>
        </svg>
      );
    case "relation":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 12h8M8 12l3-3M8 12l3 3M16 12l-3-3M16 12l-3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "people":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="8" r="3" />
          <circle cx="15" cy="8" r="3" />
          <path d="M4 20c1.2-3 4-5 8-5s6.8 2 8 5" strokeLinecap="round" />
        </svg>
      );
    case "progress-auto":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 18V6M10 18V10M16 18v-8M22 18V4" strokeLinecap="round" />
        </svg>
      );
    case "email":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "phone":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 4h4l2 5-2 2a12 12 0 006 6l2-2 5 2v4a2 2 0 01-2 2A18 18 0 013 6a2 2 0 012-2z" strokeLinejoin="round" />
        </svg>
      );
    case "files":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19A4 4 0 0117 4l-9.19 9.19" strokeLinecap="round" />
        </svg>
      );
    case "location":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21s8-4.5 8-11a8 8 0 10-16 0c0 6.5 8 11 8 11z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "rating":
      return (
        <svg className={`${g} fill-white`} viewBox="0 0 24 24">
          <path d="M12 2l2.9 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.1z" />
        </svg>
      );
    case "vote":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19h16M8 17V7l4-3 4 3v10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "signature":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 16c2-4 6-6 10-4s6 6 6 10M4 20h16" strokeLinecap="round" />
        </svg>
      );
    case "button":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="8" width="16" height="8" rx="2" />
          <path d="M9 12h6" strokeLinecap="round" />
        </svg>
      );
    case "tasks":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l2 2 4-4M7 4h10v16H7z" strokeLinejoin="round" />
        </svg>
      );
    case "translation":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 5h16M4 12h10M4 19h16" strokeLinecap="round" />
          <path d="M18 8l3 4-3 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "sentiment":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" strokeLinecap="round" />
        </svg>
      );
    case "shirt":
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 4l3 3h6l3-3 3 3v4H3V7zM4 11v9h16v-9" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg className={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      );
  }
}

function CustomFieldRowCard({
  row,
  onPatch,
  onRemove,
  removable,
}: {
  row: SuiteTaskCustomFieldRow;
  onPatch: (id: string, patch: Partial<SuiteTaskCustomFieldRow>) => void;
  onRemove: (id: string) => void;
  removable: boolean;
}) {
  const gid = glyphIdForStorageType(row.type);
  const valueControl = (() => {
    if (row.type === "textarea") {
      return (
        <textarea
          value={row.value}
          onChange={(e) => onPatch(row.id, { value: e.target.value })}
          rows={3}
          placeholder="Escribe aquí…"
          className={`mt-1 w-full resize-y ${cu.input}`}
        />
      );
    }
    if (row.type === "date") {
      return (
        <input
          type="date"
          value={row.value.length >= 10 ? row.value.slice(0, 10) : row.value}
          onChange={(e) => onPatch(row.id, { value: e.target.value })}
          className={`mt-1 w-full ${cu.input}`}
        />
      );
    }
    if (row.type === "number" || row.type === "money") {
      return (
        <input
          type="number"
          value={row.value}
          onChange={(e) => onPatch(row.id, { value: e.target.value })}
          className={`mt-1 w-full ${cu.input} ${cu.inputNumber}`}
        />
      );
    }
    if (row.type === "checkbox") {
      return (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[#ececec]">
          <input
            type="checkbox"
            checked={row.value === "true" || row.value === "1"}
            onChange={(e) => onPatch(row.id, { value: e.target.checked ? "true" : "" })}
            className="h-4 w-4 rounded border-[#555] bg-[#1a1a1a]"
          />
          Sí
        </label>
      );
    }
    if (row.type === "dropdown") {
      return (
        <input
          value={row.value}
          onChange={(e) => onPatch(row.id, { value: e.target.value })}
          placeholder="Valor seleccionado o texto"
          className={`mt-1 w-full ${cu.input}`}
        />
      );
    }
    return (
      <input
        value={row.value}
        onChange={(e) => onPatch(row.id, { value: e.target.value })}
        placeholder="Valor"
        className={`mt-1 w-full ${cu.input}`}
      />
    );
  })();

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${cu.border} bg-[#161616]`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#444] text-[#9b9b9b]">
          <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded [&>svg]:h-3.5 [&>svg]:w-3.5">
            <FieldGlyph id={gid} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          {row.id === SUITE_FIELD_CONTEXT_ID ? (
            <p className="text-xs font-medium text-[#b5b5b5]">{row.label || "Comentario"}</p>
          ) : (
            <input
              value={row.label}
              onChange={(e) => onPatch(row.id, { label: e.target.value })}
              className="w-full border-0 bg-transparent p-0 text-xs font-medium text-[#b5b5b5] outline-none ring-0 placeholder:text-[#666] focus:text-[#ececec]"
              aria-label="Nombre del campo"
            />
          )}
          {valueControl}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={row.required}
            title={row.required ? "Obligatorio: activado" : "Obligatorio: desactivado"}
            onClick={() => onPatch(row.id, { required: !row.required })}
            className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
              row.required
                ? "border-[#5b8cff] bg-[#5b8cff]/15 text-[#9ec0ff]"
                : "border-[#3d3d3d] text-[#8f8f8f] hover:border-[#555] hover:text-[#b5b5b5]"
            }`}
          >
            Obligatorio
          </button>
          {removable ? (
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              className="text-[11px] text-rose-400/90 hover:text-rose-300"
              title="Quitar campo"
            >
              Quitar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <IconBox>{icon}</IconBox>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-medium uppercase tracking-wide ${cu.label}`}>{label}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

function Vacio() {
  return <span className={`text-sm ${cu.muted}`}>Vacío</span>;
}

/** Menú flotante anclado al disparador pero siempre dentro del viewport (evita cortes abajo). */
export type SuiteMenuPopoverGeom = { left: number; top: number; width: number; maxHeight: number };

function fitMenuPopover(trigger: DOMRect, width: number, preferredMaxHeight: number, alignEnd = false): SuiteMenuPopoverGeom {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  const gap = 6;
  const rawLeft = alignEnd ? trigger.right - width : trigger.left;
  const left = Math.max(pad, Math.min(rawLeft, vw - width - pad));
  const cap = Math.max(140, Math.min(preferredMaxHeight, vh - pad * 2));

  const belowTop = trigger.bottom + gap;
  const spaceBelow = vh - pad - belowTop;
  const spaceAbove = trigger.top - pad - gap;

  let top: number;
  let maxHeight: number;

  const preferBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove;
  if (preferBelow) {
    maxHeight = Math.min(cap, Math.max(120, spaceBelow));
    top = belowTop;
  } else {
    maxHeight = Math.min(cap, Math.max(120, spaceAbove));
    top = Math.max(pad, trigger.top - gap - maxHeight);
  }

  if (top + maxHeight > vh - pad) {
    maxHeight = Math.max(120, vh - pad - top);
  }
  if (top < pad) {
    top = pad;
    maxHeight = Math.min(maxHeight, Math.max(120, vh - pad - top));
  }

  return { left, top, width, maxHeight };
}

function isoToDateInput(iso: string): string {
  const s = iso?.trim() ?? "";
  if (!s) return "";
  return s.length >= 10 ? s.slice(0, 10) : s;
}

type DraftSlice = {
  name: string;
  status: string;
  priority: string;
  progress: number;
  description: string;
  startDateStr: string;
  endDateStr: string;
  fields: SuiteTaskCustomFieldRow[];
  /** "" = sin asignar */
  assigneeUserId: string;
  /** "" = sin dependencia directa (dependencyTaskId) */
  dependencyTaskId: string;
};

function buildPatchInput(baseTask: SuiteTaskRow, d: DraftSlice): PatchSuiteTaskInput | null {
  const s0 = (d.startDateStr.trim() || isoToDateInput(baseTask.startDate)).trim();
  const e0 = (d.endDateStr.trim() || isoToDateInput(baseTask.endDate)).trim();
  if (!s0 || !e0) return null;
  const t0 = new Date(s0 + "T12:00:00");
  const t1 = new Date(e0 + "T12:00:00");
  if (!(t1.getTime() > t0.getTime())) return null;
  for (const f of d.fields) {
    if (f.required && !String(f.value ?? "").trim()) return null;
  }
  const ctxRow = d.fields.find((f) => f.id === SUITE_FIELD_CONTEXT_ID);
  const aid = d.assigneeUserId.trim();
  const dep = d.dependencyTaskId.trim();
  return {
    name: (d.name.trim() || baseTask.name || "Tarea").trim(),
    status: d.status || "TODO",
    priority: d.priority || "NORMAL",
    progress: Math.min(100, Math.max(0, d.progress)),
    description: d.description.trim() ? d.description.trim() : null,
    startDate: s0,
    endDate: e0,
    contextNote: ctxRow?.value?.trim() ? ctxRow.value.trim() : null,
    customFields: d.fields,
    assigneeUserId: aid === "" ? null : aid,
    dependencyTaskId: dep === "" ? null : dep,
  };
}

function patchPayloadFromRow(t: SuiteTaskRow): PatchSuiteTaskInput | null {
  const fields0 = initialFieldsFromTask(t);
  return buildPatchInput(t, {
    name: t.name,
    status: t.status,
    priority: t.priority,
    progress: Math.round(t.progress ?? 0),
    description: t.description ?? "",
    startDateStr: isoToDateInput(t.startDate),
    endDateStr: isoToDateInput(t.endDate),
    fields: fields0,
    assigneeUserId: t.assigneeUserId ?? "",
    dependencyTaskId: t.dependencyTaskId ?? "",
  });
}

function labelPriorityHuman(p: string): string {
  const u = (p || "").toUpperCase();
  if (u === "HIGH" || u === "ALTA") return "Alta";
  if (u === "LOW" || u === "BAJA") return "Baja";
  if (u === "URGENT" || u === "URGENTE") return "Urgente";
  return "Normal";
}

/** Acepta «45», «1h», «1h 30m», «90 min»… */
function parseHumanDurationToMinutes(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/,/g, ".");
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  let total = 0;
  const hm = s.match(/(\d+(?:\.\d+)?)\s*h(?:oras?)?/);
  if (hm) total += Math.round(Number(hm[1]) * 60);
  const mm = s.match(/(\d+)\s*(?:m\b|min\b|mins\b|minutos?\b)/);
  if (mm) total += Math.round(Number(mm[1]));
  return total > 0 ? total : null;
}

function PriorityFlag({ priority }: { priority: string }) {
  const u = (priority || "").toUpperCase();
  if (u === "URGENT" || u === "URGENTE") return <span className="text-rose-400 drop-shadow-sm">⚑</span>;
  if (u === "HIGH" || u === "ALTA") return <span className="text-amber-300">⚑</span>;
  if (u === "LOW" || u === "BAJA") return <span className="text-neutral-500">⚑</span>;
  return <span className="text-sky-400">⚑</span>;
}

export type SuitePlanningPeerTask = { id: string; name: string; wbsCode?: string | null };

function statusLabelFromMap(id: string, map: Record<string, string>): string {
  return map[id] ?? id;
}

function contextValueFromPatch(p: PatchSuiteTaskInput): string {
  const row = p.customFields?.find((f) => f.id === SUITE_FIELD_CONTEXT_ID);
  return (row?.value ?? p.contextNote ?? "").trim();
}

/** Mensajes estilo ClickUp: quién hizo qué (comparando el último guardado vs el nuevo). */
function diffPatchToActivityLines(
  actor: string,
  prev: PatchSuiteTaskInput | null,
  next: PatchSuiteTaskInput,
  statusLabelById: Record<string, string>,
  assigneeNameById?: Record<string, string>,
  taskTitleById?: Record<string, string>,
): { message: string }[] {
  if (!prev) return [];
  const a = actor.trim();
  const isTu = a.toLowerCase() === "tú" || a.toLowerCase() === "tu";
  const lead = (tu: string, el: string) => (isTu ? tu : `${a} ${el}`);
  const out: { message: string }[] = [];

  const labelAssignee = (id: string | null | undefined) => {
    if (id == null || id === "") return "sin asignar";
    return assigneeNameById?.[id] ?? id.slice(0, 8);
  };
  const prevAssign = prev.assigneeUserId ?? null;
  const nextAssign = next.assigneeUserId ?? null;
  if (prevAssign !== nextAssign) {
    out.push({
      message: lead(
        `cambiaste la asignación (${labelAssignee(prevAssign)} → ${labelAssignee(nextAssign)})`,
        `cambió la asignación (${labelAssignee(prevAssign)} → ${labelAssignee(nextAssign)})`,
      ),
    });
  }

  const labelDep = (id: string | null | undefined) => {
    if (id == null || id === "") return "ninguna";
    const t = taskTitleById?.[id];
    if (t) return t.length > 48 ? `${t.slice(0, 48)}…` : t;
    return id.slice(0, 8);
  };
  const prevDep = prev.dependencyTaskId ?? null;
  const nextDep = next.dependencyTaskId ?? null;
  if (prevDep !== nextDep) {
    out.push({
      message: lead(
        `cambiaste la dependencia (${labelDep(prevDep)} → ${labelDep(nextDep)})`,
        `cambió la dependencia (${labelDep(prevDep)} → ${labelDep(nextDep)})`,
      ),
    });
  }

  const prevName = prev.name ?? "";
  const nextName = next.name ?? "";
  if (prevName !== nextName) {
    const short = (s: string) => (s.length > 56 ? `${s.slice(0, 56)}…` : s);
    out.push({
      message: lead(
        `cambiaste el nombre de «${short(prevName)}» a «${short(nextName)}»`,
        `cambió el nombre de «${short(prevName)}» a «${short(nextName)}»`,
      ),
    });
  }
  const prevStatus = prev.status ?? "";
  const nextStatus = next.status ?? "";
  if (prevStatus !== nextStatus) {
    const x = statusLabelFromMap(prevStatus, statusLabelById);
    const y = statusLabelFromMap(nextStatus, statusLabelById);
    out.push({
      message: lead(`cambiaste el estado de ${x} a ${y}`, `cambió el estado de ${x} a ${y}`),
    });
  }
  const prevPriority = prev.priority ?? "";
  const nextPriority = next.priority ?? "";
  if (prevPriority !== nextPriority) {
    const x = labelPriorityHuman(prevPriority);
    const y = labelPriorityHuman(nextPriority);
    out.push({
      message: lead(`cambiaste la prioridad de ${x} a ${y}`, `cambió la prioridad de ${x} a ${y}`),
    });
  }
  if (Math.round(prev.progress ?? 0) !== Math.round(next.progress ?? 0)) {
    const x = Math.round(prev.progress ?? 0);
    const y = Math.round(next.progress ?? 0);
    out.push({
      message: lead(`ajustaste el avance de ${x}% a ${y}%`, `ajustó el avance de ${x}% a ${y}%`),
    });
  }
  const pd = (prev.description ?? "").trim();
  const nd = (next.description ?? "").trim();
  if (pd !== nd) {
    out.push({
      message: lead("actualizaste la descripción de la tarea", "actualizó la descripción de la tarea"),
    });
  }
  if (prev.startDate !== next.startDate || prev.endDate !== next.endDate) {
    out.push({
      message: lead(
        `actualizaste las fechas del plan (${prev.startDate} → ${prev.endDate}) por (${next.startDate} → ${next.endDate})`,
        `actualizó las fechas del plan (${prev.startDate} → ${prev.endDate}) por (${next.startDate} → ${next.endDate})`,
      ),
    });
  }
  const pc = contextValueFromPatch(prev);
  const nc = contextValueFromPatch(next);
  if (pc !== nc) {
    out.push({
      message: lead("actualizaste el comentario de contexto", "actualizó el comentario de contexto"),
    });
  }
  const sfPrev = JSON.stringify(prev.customFields ?? []);
  const sfNext = JSON.stringify(next.customFields ?? []);
  if (sfPrev !== sfNext && pc === nc) {
    out.push({
      message: lead("actualizaste los campos personalizados", "actualizó los campos personalizados"),
    });
  }
  return out;
}

function statusDotRing(statusId: string, cfg: TaskStatusConfig): string {
  const s = cfg.statuses.find((x) => x.id === statusId);
  if (!s) return "border-neutral-500 bg-neutral-600/40";
  if (s.category === "done") return "border-emerald-400/90 bg-emerald-500/35";
  if (s.category === "active") return "border-sky-400/90 bg-sky-500/35";
  return "border-amber-400/80 bg-amber-500/30";
}

export type SessionActivityLine = {
  id: string;
  t: number;
  actor: string;
  message: string;
  kind: "field_change" | "comment" | "scheduled" | "time_log";
};

type ActivityKind = SessionActivityLine["kind"];

const ACTIVITY_KIND_FILTER_OPTIONS: { id: ActivityKind; label: string }[] = [
  { id: "field_change", label: "Cambios de campo" },
  { id: "comment", label: "Comentarios" },
  { id: "scheduled", label: "Recordatorios" },
  { id: "time_log", label: "Tiempo registrado" },
];

function defaultActivityKindEnabled(): Record<ActivityKind, boolean> {
  return { field_change: true, comment: true, scheduled: true, time_log: true };
}

function normalizeActivityFromTask(t: SuiteTaskRow): SessionActivityLine[] {
  let raw: unknown = t.activityLog as unknown;
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  const arr = Array.isArray(raw) ? raw : [];
  const lines: SessionActivityLine[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const message = typeof o.message === "string" ? o.message : "";
    const kind = o.kind;
    if (!id || !message) continue;
    if (kind !== "field_change" && kind !== "comment" && kind !== "scheduled" && kind !== "time_log") continue;
    const tRaw = o.t;
    const tn =
      typeof tRaw === "number" && Number.isFinite(tRaw)
        ? tRaw
        : typeof tRaw === "string" && Number.isFinite(Number(tRaw))
          ? Number(tRaw)
          : 0;
    const actor = typeof o.actor === "string" ? o.actor : "";
    lines.push({ id, t: tn, actor, message, kind });
  }
  return lines.sort((a, b) => b.t - a.t);
}

export function SuiteTaskDetailSheet({
  projectId,
  projectName,
  task,
  statusConfig,
  open,
  onClose,
  onSaved,
  onAddSubtask,
  onDeleteTask,
  statusOptions,
  activityActorName = "Tú",
  peerTasks = [],
}: {
  projectId: string;
  projectName: string;
  task: SuiteTaskRow | null;
  statusConfig: TaskStatusConfig;
  open: boolean;
  onClose: () => void;
  /** Tras guardar en servidor; pasa la fila devuelta por el API para actualizar lista/actividad sin esperar solo a un refetch. */
  onSaved: (updatedRow?: SuiteTaskRow) => void | Promise<void>;
  onAddSubtask: (parentTaskId: string) => void;
  /** Si se define, se muestra «Eliminar tarea» y se llama al confirmar. */
  onDeleteTask?: (taskId: string) => Promise<void>;
  statusOptions: { id: string; label: string }[];
  /** Nombre para el historial de actividad (p. ej. nombre del usuario con sesión). */
  activityActorName?: string;
  /** Otras tareas del mismo proyecto (para relaciones / dependencia). */
  peerTasks?: SuitePlanningPeerTask[];
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("NORMAL");
  const [progress, setProgress] = useState(0);
  const [description, setDescription] = useState("");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");
  const [autosaveBusy, setAutosaveBusy] = useState(false);
  const [syncHint, setSyncHint] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [fields, setFields] = useState<SuiteTaskCustomFieldRow[]>([]);
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [planningUsers, setPlanningUsers] = useState<User[]>([]);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [timeSaving, setTimeSaving] = useState(false);
  const [dependencyTaskId, setDependencyTaskId] = useState("");
  const [relationsOpen, setRelationsOpen] = useState(false);
  const [relationsStep, setRelationsStep] = useState<"menu" | "pick">("menu");
  const [relationSearch, setRelationSearch] = useState("");
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [priorityMenuGeom, setPriorityMenuGeom] = useState<SuiteMenuPopoverGeom | null>(null);
  const [relationsMenuGeom, setRelationsMenuGeom] = useState<SuiteMenuPopoverGeom | null>(null);
  const [sessionActivity, setSessionActivity] = useState<SessionActivityLine[]>([]);
  const [activitySearchOpen, setActivitySearchOpen] = useState(false);
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [activityFilterOpen, setActivityFilterOpen] = useState(false);
  const [activityNotifOpen, setActivityNotifOpen] = useState(false);
  const [activityKindEnabled, setActivityKindEnabled] = useState<Record<ActivityKind, boolean>>(defaultActivityKindEnabled);
  const [deleting, setDeleting] = useState(false);
  const activitySearchInputRef = useRef<HTMLInputElement | null>(null);
  const activityFilterBtnRef = useRef<HTMLButtonElement | null>(null);
  const activityFilterPanelRef = useRef<HTMLDivElement | null>(null);
  const activityNotifBtnRef = useRef<HTMLButtonElement | null>(null);
  const activityNotifPanelRef = useRef<HTMLDivElement | null>(null);
  const priorityMenuBtnRef = useRef<HTMLButtonElement | null>(null);
  const priorityMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const relationsMenuBtnRef = useRef<HTMLButtonElement | null>(null);
  const relationsMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const fieldPickerRef = useRef<HTMLDivElement | null>(null);
  const fieldSearchRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const lastAppliedSigRef = useRef("");
  const lastAppliedPatchRef = useRef<PatchSuiteTaskInput | null>(null);
  const pendingPatchRef = useRef<PatchSuiteTaskInput | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);

  const statusLabelById = useMemo(
    () => Object.fromEntries(statusOptions.map((o) => [o.id, o.label])),
    [statusOptions],
  );

  const assigneeNameById = useMemo(
    () => Object.fromEntries(planningUsers.map((u) => [u.id, (u.name?.trim() || u.fullName?.trim() || u.email) as string])),
    [planningUsers],
  );

  const taskTitleById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of peerTasks) {
      const w = p.wbsCode?.trim();
      m[p.id] = `${w ? `${w} · ` : ""}${(p.name || "").trim()}`.trim() || p.id.slice(0, 8);
    }
    if (task?.id) m[task.id] = (task.name || "").trim() || task.id.slice(0, 8);
    return m;
  }, [peerTasks, task?.id, task?.name]);

  useEffect(() => {
    let c = false;
    fetchAssignableSalesUsers(true)
      .then((list) => {
        if (!c) setPlanningUsers(list);
      })
      .catch(() => {
        if (!c) setPlanningUsers([]);
      });
    return () => {
      c = true;
    };
  }, []);

  const activitySig = useMemo(() => JSON.stringify(task?.activityLog ?? null), [task?.activityLog]);

  useLayoutEffect(() => {
    setPortalEl(document.body);
  }, []);

  /** Antes de pintar: hidratar borrador para que el autosave no envíe datos vacíos ni mezcle tareas. */
  useLayoutEffect(() => {
    if (!open || !task) {
      if (!open) currentTaskIdRef.current = null;
      return;
    }
    setName(task.name);
    setStatus(task.status);
    setPriority(task.priority);
    setProgress(Math.round(task.progress ?? 0));
    setDescription(task.description ?? "");
    setStartDateStr(isoToDateInput(task.startDate));
    setEndDateStr(isoToDateInput(task.endDate));
    setFields(initialFieldsFromTask(task));
    setAssigneeUserId(task.assigneeUserId ?? "");
    setDependencyTaskId(task.dependencyTaskId ?? "");
    setRelationsOpen(false);
    setRelationsStep("menu");
    setRelationSearch("");
    setPriorityMenuOpen(false);
    setActivitySearchOpen(false);
    setActivitySearchQuery("");
    setActivityFilterOpen(false);
    setActivityNotifOpen(false);
    setActivityKindEnabled(defaultActivityKindEnabled());
    setTimeOpen(false);
    setTimeMinutes("");
    setTimeNote("");
    setErr(null);
    setSyncHint("idle");
    const init = patchPayloadFromRow(task);
    lastAppliedPatchRef.current = init;
    lastAppliedSigRef.current = init ? JSON.stringify(init) : "";
    currentTaskIdRef.current = task.id;
  }, [open, task?.id]);

  /** Actividad persistida: al abrir o cuando el padre recarga la tarea (p. ej. tras guardar). */
  useEffect(() => {
    if (!open || !task) return;
    setSessionActivity(normalizeActivityFromTask(task));
  }, [open, task?.id, activitySig]);

  useEffect(() => {
    if (!fieldPickerOpen) return;
    setFieldSearch("");
    const t = window.setTimeout(() => fieldSearchRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [fieldPickerOpen]);

  useEffect(() => {
    if (!fieldPickerOpen) return;
    function onDoc(e: MouseEvent) {
      const el = fieldPickerRef.current;
      if (el && !el.contains(e.target as Node)) setFieldPickerOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [fieldPickerOpen]);

  useEffect(() => {
    if (!priorityMenuOpen && !relationsOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (priorityMenuOpen && !priorityMenuBtnRef.current?.contains(t) && !priorityMenuPanelRef.current?.contains(t)) {
        setPriorityMenuOpen(false);
      }
      if (relationsOpen && !relationsMenuBtnRef.current?.contains(t) && !relationsMenuPanelRef.current?.contains(t)) {
        setRelationsOpen(false);
        setRelationsStep("menu");
        setRelationSearch("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [priorityMenuOpen, relationsOpen]);

  useEffect(() => {
    if (!activityFilterOpen && !activityNotifOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const inF = activityFilterBtnRef.current?.contains(t) || activityFilterPanelRef.current?.contains(t);
      const inN = activityNotifBtnRef.current?.contains(t) || activityNotifPanelRef.current?.contains(t);
      if (activityFilterOpen && !inF) setActivityFilterOpen(false);
      if (activityNotifOpen && !inN) setActivityNotifOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [activityFilterOpen, activityNotifOpen]);

  useEffect(() => {
    if (!activitySearchOpen) return;
    const id = window.setTimeout(() => activitySearchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [activitySearchOpen]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (fieldPickerOpen) {
        e.preventDefault();
        setFieldPickerOpen(false);
        return;
      }
      if (activityFilterOpen) {
        e.preventDefault();
        setActivityFilterOpen(false);
        return;
      }
      if (activityNotifOpen) {
        e.preventDefault();
        setActivityNotifOpen(false);
        return;
      }
      if (activitySearchOpen) {
        e.preventDefault();
        setActivitySearchOpen(false);
        return;
      }
      if (priorityMenuOpen) {
        e.preventDefault();
        setPriorityMenuOpen(false);
        return;
      }
      if (relationsOpen) {
        e.preventDefault();
        if (relationsStep === "pick") {
          setRelationsStep("menu");
          setRelationSearch("");
        } else {
          setRelationsOpen(false);
        }
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    open,
    onClose,
    fieldPickerOpen,
    activityFilterOpen,
    activityNotifOpen,
    activitySearchOpen,
    priorityMenuOpen,
    relationsOpen,
    relationsStep,
  ]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const pendingPatch = useMemo(() => {
    if (!task) return null;
    return buildPatchInput(task, {
      name,
      status,
      priority,
      progress,
      description,
      startDateStr,
      endDateStr,
      fields,
      assigneeUserId,
      dependencyTaskId,
    });
  }, [task, name, status, priority, progress, description, startDateStr, endDateStr, fields, assigneeUserId, dependencyTaskId]);

  const draftSig = pendingPatch ? JSON.stringify(pendingPatch) : "";

  /** Guardado automático (~0,7 s) tras cada cambio válido. */
  useEffect(() => {
    pendingPatchRef.current = pendingPatch;
    if (!open || !task) return;
    if (!draftSig) {
      setSyncHint((h) => (h === "saving" ? h : "idle"));
      return;
    }
    if (draftSig === lastAppliedSigRef.current) {
      setSyncHint("idle");
      return;
    }
    setSyncHint("dirty");
    const targetTaskId = task.id;
    const t = window.setTimeout(() => {
      void (async () => {
        const body = pendingPatchRef.current;
        if (!body) return;
        const sig = JSON.stringify(body);
        if (sig === lastAppliedSigRef.current) return;
        if (currentTaskIdRef.current !== targetTaskId) return;
        setAutosaveBusy(true);
        setSyncHint("saving");
        setErr(null);
        try {
          const prevPatch = lastAppliedPatchRef.current;
          const lines = diffPatchToActivityLines(
            activityActorName,
            prevPatch,
            body,
            statusLabelById,
            assigneeNameById,
            taskTitleById,
          );
          const stamp = Date.now();
          const appendActivityEntries =
            lines.length > 0
              ? lines.map((line, i) => ({
                  id: `chg-${stamp}-${i}`,
                  t: stamp + i,
                  actor: activityActorName,
                  message: line.message,
                  kind: "field_change" as const,
                }))
              : undefined;
          const updatedRow = await patchSuiteTask(projectId, targetTaskId, {
            ...body,
            ...(appendActivityEntries ? { appendActivityEntries } : {}),
          });
          if (currentTaskIdRef.current !== targetTaskId) return;
          lastAppliedSigRef.current = sig;
          lastAppliedPatchRef.current = body;
          setSessionActivity(normalizeActivityFromTask(updatedRow));
          void onSaved(updatedRow);
          setSyncHint("saved");
          window.setTimeout(() => setSyncHint((s) => (s === "saved" ? "idle" : s)), 2200);
        } catch (e) {
          if (currentTaskIdRef.current === targetTaskId) {
            setSyncHint("error");
            setErr(e instanceof Error ? e.message : "Error al sincronizar");
          }
        } finally {
          setAutosaveBusy(false);
        }
      })();
    }, 500);
    return () => window.clearTimeout(t);
  }, [open, task?.id, draftSig, projectId, onSaved, activityActorName, statusLabelById, assigneeNameById, taskTitleById]);

  const durationPreview = useMemo(() => {
    if (!startDateStr?.trim() || !endDateStr?.trim()) return null;
    const a = new Date(`${startDateStr.trim()}T12:00:00`);
    const b = new Date(`${endDateStr.trim()}T12:00:00`);
    if (!(b.getTime() > a.getTime())) return null;
    const d = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
    return `${d} d`;
  }, [startDateStr, endDateStr]);

  const patchField = useCallback((id: string, patch: Partial<SuiteTaskCustomFieldRow>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const removeFieldRow = useCallback((id: string) => {
    if (id === SUITE_FIELD_CONTEXT_ID || id === SUITE_FIELD_STORY_POINTS || id === SUITE_FIELD_LABELS) return;
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const addFieldFromPicker = useCallback((item: FieldTypeItem) => {
    setFieldPickerOpen(false);
    setFields((prev) => {
      if (prev.length >= 40) return prev;
      return [...prev, menuItemToNewField(item)];
    });
  }, []);

  const handleDeleteTask = useCallback(async () => {
    if (!task || !onDeleteTask) return;
    if (!window.confirm("¿Eliminar esta tarea? También se eliminarán sus subtareas. No se puede deshacer.")) return;
    setDeleting(true);
    setErr(null);
    try {
      await onDeleteTask(task.id);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo eliminar la tarea");
    } finally {
      setDeleting(false);
    }
  }, [task, onDeleteTask, onClose]);

  const clipActivityText = (s: string, n: number) => {
    const t = s.trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
  };

  const appendCommentActivity = useCallback(
    async (text: string) => {
      if (!task) return;
      const stamp = Date.now();
      const actor = activityActorName;
      const isTu = actor.trim().toLowerCase() === "tú" || actor.trim().toLowerCase() === "tu";
      const body = clipActivityText(text, 480);
      const entry: SessionActivityLine = {
        id: `cmt-${stamp}`,
        t: stamp,
        actor,
        message: isTu ? `publicaste: «${body}»` : `${actor} publicó: «${body}»`,
        kind: "comment",
      };
      setErr(null);
      try {
        const updatedRow = await patchSuiteTask(projectId, task.id, { appendActivityEntries: [entry] });
        setSessionActivity(normalizeActivityFromTask(updatedRow));
        void onSaved(updatedRow);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo guardar el comentario en la actividad";
        setErr(msg);
        throw e;
      }
    },
    [activityActorName, projectId, task, onSaved],
  );

  const appendScheduleActivity = useCallback(
    async (isoLocal: string) => {
      if (!task) return;
      const stamp = Date.now();
      const when = new Date(isoLocal).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
      const actor = activityActorName;
      const isTu = actor.trim().toLowerCase() === "tú" || actor.trim().toLowerCase() === "tu";
      const entry: SessionActivityLine = {
        id: `sch-${stamp}`,
        t: stamp,
        actor,
        message: isTu
          ? `programaste un recordatorio en la actividad para ${when}`
          : `${actor} programó un recordatorio para ${when}`,
        kind: "scheduled",
      };
      setErr(null);
      try {
        const updatedRow = await patchSuiteTask(projectId, task.id, { appendActivityEntries: [entry] });
        setSessionActivity(normalizeActivityFromTask(updatedRow));
        void onSaved(updatedRow);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo guardar el recordatorio";
        setErr(msg);
        throw e;
      }
    },
    [activityActorName, projectId, task, onSaved],
  );

  const appendTimeLogActivity = useCallback(async () => {
    if (!task) return;
    const parsed = parseHumanDurationToMinutes(timeMinutes);
    const mins = parsed ?? Math.round(Number(timeMinutes.replace(",", ".")));
    if (!Number.isFinite(mins) || mins <= 0) {
      setErr("Indica el tiempo (p. ej. 45, 1h 30m, 90 min).");
      return;
    }
    const stamp = Date.now();
    const actor = activityActorName;
    const isTu = actor.trim().toLowerCase() === "tú" || actor.trim().toLowerCase() === "tu";
    const note = timeNote.trim();
    const notePart = note ? `: ${clipActivityText(note, 200)}` : "";
    const entry: SessionActivityLine = {
      id: `time-${stamp}`,
      t: stamp,
      actor,
      message: isTu
        ? `registraste ${mins} min en la tarea${notePart}`
        : `${actor} registró ${mins} min en la tarea${notePart}`,
      kind: "time_log",
    };
    setTimeSaving(true);
    setErr(null);
    try {
      const updatedRow = await patchSuiteTask(projectId, task.id, { appendActivityEntries: [entry] });
      setSessionActivity(normalizeActivityFromTask(updatedRow));
      void onSaved(updatedRow);
      setTimeMinutes("");
      setTimeNote("");
      setTimeOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo registrar el tiempo";
      setErr(msg);
      throw e;
    } finally {
      setTimeSaving(false);
    }
  }, [activityActorName, projectId, task, timeMinutes, timeNote, onSaved]);

  const filteredSessionActivity = useMemo(() => {
    const q = activitySearchQuery.trim().toLowerCase();
    return sessionActivity.filter((e) => {
      if (!activityKindEnabled[e.kind]) return false;
      if (!q) return true;
      const hay = `${e.actor} ${e.message} ${new Date(e.t).toLocaleString("es-CL")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sessionActivity, activityKindEnabled, activitySearchQuery]);

  const scheduledActivityCount = useMemo(
    () => sessionActivity.filter((e) => e.kind === "scheduled").length,
    [sessionActivity],
  );

  if (!open || !task) return null;

  const statusLabel = statusOptions.find((o) => o.id === status)?.label ?? status;
  const statusPill = statusPillFromConfig(status, statusConfig);
  const priorityLabel = labelPriorityHuman(priority);
  const predCount = task.predecessorIds?.length ?? 0;
  const relationsText =
    predCount > 0
      ? `${predCount} predecesor${predCount === 1 ? "" : "es"}`
      : dependencyTaskId.trim() || task.dependencyTaskId
        ? "Dependencia configurada"
        : null;
  const relQ = relationSearch.trim().toLowerCase();
  const relationPickList = peerTasks.filter((p) => {
    if (!relQ) return true;
    const hay = `${p.wbsCode ?? ""} ${p.name}`.toLowerCase();
    return hay.includes(relQ);
  });
  const durationText =
    task.duration != null && task.duration > 0 ? `${task.duration} d` : null;
  const durationDisplay = durationPreview ?? durationText;
  const storyPointsRow = fields.find((f) => f.id === SUITE_FIELD_STORY_POINTS);
  const labelsRow = fields.find((f) => f.id === SUITE_FIELD_LABELS);
  const assigneeOrphan =
    assigneeUserId.trim() !== "" && !planningUsers.some((u) => u.id === assigneeUserId);

  const q = fieldSearch.trim().toLowerCase();
  const filteredFields = FIELD_TYPE_ITEMS.filter((it) => !q || it.label.toLowerCase().includes(q));
  const aiFields = filteredFields.filter((it) => it.section === "ai");
  const allFields = filteredFields.filter((it) => it.section === "all");

  const shell = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[1px] sm:p-5 md:p-8"
      onClick={onClose}
    >
      <div
        className={`flex h-[min(900px,calc(100dvh-2.5rem))] w-full max-w-[min(1240px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border shadow-2xl ${cu.border} ${cu.shell}`}
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        aria-labelledby="suite-task-detail-title"
      >
        <header className={`flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4 ${cu.border} ${cu.panel}`}>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-[11px] ${cu.muted}`}>
              {projectName} · <span className="font-mono text-[#b5b5b5]">{task.wbsCode ?? task.id.slice(0, 8)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#b5b5b5] hover:bg-[#252525] hover:text-white"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_min(360px,36%)]">
          <div className={`suite-scroll min-h-0 min-w-0 overflow-y-auto border-b px-5 py-5 lg:border-b-0 lg:border-r ${cu.border}`}>
            <div className="mb-5 flex items-start gap-3">
              <span
                className={`mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 ${statusDotRing(status, statusConfig)}`}
                title={statusLabel}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <label htmlFor="suite-task-detail-title" className="sr-only">
                  Nombre de la tarea
                </label>
                <input
                  id="suite-task-detail-title"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre de la tarea"
                  className="w-full border-0 border-b border-transparent bg-transparent pb-1 text-xl font-semibold leading-snug tracking-tight text-white outline-none ring-0 placeholder:text-[#555] focus:border-[#5c5c5c] md:text-2xl"
                />
              </div>
            </div>

            <div className="mb-6 rounded-lg border border-[#2f2f2f] bg-gradient-to-r from-violet-950/35 via-fuchsia-950/25 to-cyan-950/30 px-3 py-2.5 text-xs leading-relaxed text-[#c4c4c4]">
              <span
                className="mr-2 inline-block h-4 w-4 shrink-0 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-cyan-400 align-middle"
                aria-hidden
              />
              Pídele a IA que escriba una descripción, cree un resumen o busque tareas similares (demo).
            </div>

            {err ? (
              <p className="mb-4 rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">{err}</p>
            ) : null}

            <div className="grid grid-cols-1 gap-x-14 gap-y-5 lg:grid-cols-2">
              <div className="space-y-5">
                <MetaRow
                  label="Estado"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={statusPill.className}>{statusPill.text}</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={`min-w-[160px] max-w-[280px] flex-1 ${cu.input}`}
                    >
                      {!statusOptions.some((o) => o.id === status) ? <option value={status}>{status}</option> : null}
                      {statusOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </MetaRow>

                <MetaRow
                  label="Fechas"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
                    </svg>
                  }
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="min-w-0 flex-1">
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${cu.label}`}>Inicio</span>
                      <input
                        type="date"
                        value={startDateStr}
                        onChange={(e) => setStartDateStr(e.target.value)}
                        className={`mt-1 block w-full min-w-[9.5rem] ${cu.input}`}
                      />
                    </label>
                    <span className={`hidden pb-2 text-lg sm:inline ${cu.muted}`} aria-hidden>
                      →
                    </span>
                    <label className="min-w-0 flex-1">
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${cu.label}`}>Fin</span>
                      <input
                        type="date"
                        value={endDateStr}
                        onChange={(e) => setEndDateStr(e.target.value)}
                        className={`mt-1 block w-full min-w-[9.5rem] ${cu.input}`}
                      />
                    </label>
                  </div>
                  <p className={`mt-2 text-xs ${cu.muted}`}>
                    Vista previa: {formatIsoDateDDMMAAAA(startDateStr)} → {formatIsoDateDDMMAAAA(endDateStr)}
                  </p>
                </MetaRow>

                <MetaRow
                  label="Duración estimada"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  {durationDisplay ? <span className="text-sm text-[#ececec]">{durationDisplay}</span> : <Vacio />}
                </MetaRow>

                <MetaRow
                  label="Registrar el tiempo"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <circle cx="12" cy="13" r="7" />
                      <path d="M12 10v4l2 1M9 3h6" strokeLinecap="round" />
                    </svg>
                  }
                >
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setTimeOpen((v) => !v)}
                      className="inline-flex items-center gap-2 text-sm text-[#a8a8a8] hover:text-[#ececec]"
                      aria-expanded={timeOpen}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#444] bg-[#1e1e1e]">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                      {timeOpen ? "Ocultar" : "Agregar tiempo"}
                    </button>
                    {timeOpen ? (
                      <div className="max-w-md space-y-2.5 rounded-xl border border-[#333] bg-[#161616] p-3 shadow-inner">
                        <p className={`text-[10px] font-medium uppercase tracking-wide ${cu.label}`}>Tiempo de esta tarea</p>
                        <div className="flex items-center gap-2 rounded-lg border border-[#2f2f2f] bg-[#121212] pl-3 pr-1 py-1">
                          <input
                            value={timeMinutes}
                            onChange={(e) => setTimeMinutes(e.target.value)}
                            placeholder="p. ej. 3 h 20 m o 45"
                            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-[#ececec] placeholder:text-[#555] focus:outline-none focus:ring-0"
                            aria-label="Tiempo trabajado"
                          />
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#444] bg-[#1e1e1e] text-[#888]"
                            title="Cronómetro (próximamente)"
                            aria-hidden
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        </div>
                        <p className={`flex items-center gap-1.5 text-[11px] ${cu.muted}`}>
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v6l3 2" strokeLinecap="round" />
                          </svg>
                          Se guarda como entrada en Actividad (minutos + nota).
                        </p>
                        <label className="block">
                          <span className={`text-[10px] font-medium uppercase tracking-wide ${cu.label}`}>Notas</span>
                          <input
                            value={timeNote}
                            onChange={(e) => setTimeNote(e.target.value)}
                            placeholder="Qué hiciste…"
                            className={`mt-1 block w-full ${cu.input}`}
                          />
                        </label>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className={`text-[10px] ${cu.muted}`}>Facturable (demo)</span>
                          <button
                            type="button"
                            disabled={timeSaving}
                            onClick={() => void appendTimeLogActivity()}
                            className={`${cu.btnPrimary} shrink-0 px-4 disabled:opacity-50`}
                          >
                            {timeSaving ? "Guardando…" : "Guardar"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </MetaRow>

                <MetaRow
                  label="Relaciones"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" />
                    </svg>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {relationsText ? <span className="text-sm text-[#ececec]">{relationsText}</span> : <Vacio />}
                    <button
                      ref={relationsMenuBtnRef}
                      type="button"
                      onClick={() => {
                        if (relationsOpen) {
                          setRelationsOpen(false);
                          setRelationsStep("menu");
                          setRelationSearch("");
                          return;
                        }
                        const r = relationsMenuBtnRef.current?.getBoundingClientRect();
                        if (r) {
                          const width = 340;
                          setRelationsMenuGeom(
                            fitMenuPopover(r, width, Math.min(420, window.innerHeight * 0.72), true),
                          );
                        }
                        setRelationsStep("menu");
                        setRelationsOpen(true);
                      }}
                      className="rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] px-2.5 py-1.5 text-xs text-[#c4c4c4] hover:bg-[#2a2a2a]"
                    >
                      {relationsOpen ? "Cerrar" : "Agregar relación"}
                    </button>
                  </div>
                </MetaRow>
              </div>

              <div className="space-y-5">
                <MetaRow
                  label="Personas asignadas"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <circle cx="9" cy="8" r="3" />
                      <circle cx="15" cy="8" r="3" />
                      <path d="M4 20c1.2-3 4-5 8-5s6.8 2 8 5" strokeLinecap="round" />
                    </svg>
                  }
                >
                  <select
                    value={assigneeUserId}
                    onChange={(e) => setAssigneeUserId(e.target.value)}
                    className={`max-w-full ${cu.input}`}
                    aria-label="Persona asignada"
                  >
                    <option value="">Sin asignar</option>
                    {planningUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.name?.trim() || u.fullName?.trim() || u.email) as string}
                      </option>
                    ))}
                    {assigneeOrphan ? (
                      <option value={assigneeUserId}>
                        {task.assigneeUser?.name?.trim() ||
                          task.assigneeUser?.email?.trim() ||
                          `Usuario (${assigneeUserId.slice(0, 8)}…)`}
                      </option>
                    ) : null}
                  </select>
                  <p className={`mt-1.5 text-[10px] leading-snug ${cu.muted}`}>
                    La asignación se sincroniza con la tarea del proyecto y aparece en actividad al guardar.
                  </p>
                </MetaRow>

                <MetaRow
                  label="Prioridad"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M4 20V4l8 4 8-4v16" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <div className="relative max-w-[300px]">
                    <button
                      ref={priorityMenuBtnRef}
                      type="button"
                      onClick={() => {
                        if (priorityMenuOpen) {
                          setPriorityMenuOpen(false);
                          return;
                        }
                        const r = priorityMenuBtnRef.current?.getBoundingClientRect();
                        if (r) {
                          const width = 280;
                          setPriorityMenuGeom(fitMenuPopover(r, width, Math.min(400, window.innerHeight * 0.65)));
                        }
                        setPriorityMenuOpen(true);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border border-[#3d3d3d] bg-[#1a1a1a] px-3 py-2 text-left text-sm text-[#ececec] hover:border-[#555]`}
                      aria-expanded={priorityMenuOpen}
                      aria-haspopup="listbox"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-lg leading-none">
                          <PriorityFlag priority={priority} />
                        </span>
                        {labelPriorityHuman(priority)}
                      </span>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#888]" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" />
                      </svg>
                    </button>
                    <p className={`mt-1.5 text-[10px] ${cu.muted}`}>Menú estilo ClickUp (banderas + borrar).</p>
                  </div>
                </MetaRow>

                <MetaRow
                  label="Puntos de sprint"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  }
                >
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    inputMode="decimal"
                    value={storyPointsRow?.value ?? ""}
                    onChange={(e) => patchField(SUITE_FIELD_STORY_POINTS, { value: e.target.value })}
                    placeholder="p. ej. 3"
                    className={`max-w-[200px] ${cu.input} ${cu.inputNumber}`}
                    aria-label="Puntos de sprint"
                  />
                </MetaRow>

                <MetaRow
                  label="Etiquetas"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M4 10V4h6l12 12-6 6L4 10z" strokeLinejoin="round" />
                      <circle cx="8.5" cy="7.5" r="1" fill="currentColor" />
                    </svg>
                  }
                >
                  <input
                    value={labelsRow?.value ?? ""}
                    onChange={(e) => patchField(SUITE_FIELD_LABELS, { value: e.target.value })}
                    placeholder="p. ej. frontend, bloqueante"
                    className={`w-full max-w-md ${cu.input}`}
                    aria-label="Etiquetas"
                  />
                </MetaRow>
              </div>
            </div>

            <div className="my-8 border-t border-[#252525]" />

            <div className="space-y-3">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium text-[#b5b5b5] hover:text-[#ececec]"
                onClick={() => descriptionRef.current?.focus()}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descripción
              </button>
              <textarea
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe el alcance, criterios de aceptación o notas para el equipo…"
                className={`w-full resize-y ${cu.input}`}
              />
              <button type="button" className="flex items-center gap-2 text-xs font-medium text-violet-300 hover:text-violet-200">
                <span className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-violet-400 to-pink-400" aria-hidden />
                Escribe con IA
              </button>
            </div>

            <div className="my-8 border-t border-[#252525]" />

            <div className="relative">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${cu.label}`}>Campos</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#9b9b9b] hover:bg-[#252525] hover:text-white"
                    title="Buscar en campos (demo)"
                    aria-label="Buscar"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#9b9b9b] hover:bg-[#252525] hover:text-white"
                    title="Expandir (demo)"
                    aria-label="Expandir"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 3H5a2 2 0 00-2 2v4M21 9V5a2 2 0 00-2-2h-4M15 21h4a2 2 0 002-2v-4M3 15v4a2 2 0 002 2h4" strokeLinecap="round" />
                    </svg>
                  </button>
                  <div className="relative" ref={fieldPickerRef}>
                    <button
                      type="button"
                      onClick={() => setFieldPickerOpen((v) => !v)}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-[#2a2a2a] text-lg font-light leading-none text-[#ececec] hover:bg-[#353535]"
                      aria-expanded={fieldPickerOpen}
                      aria-haspopup="listbox"
                      title="Añadir campo"
                    >
                      +
                    </button>
                    {fieldPickerOpen ? (
                      <div
                        className="absolute right-0 z-[120] mt-1.5 w-[min(100vw-2rem,380px)] overflow-hidden rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] shadow-2xl"
                        role="listbox"
                      >
                        <div className="border-b border-[#333] p-2">
                          <div className="relative">
                            <svg
                              viewBox="0 0 24 24"
                              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="11" cy="11" r="7" />
                              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                            </svg>
                            <input
                              ref={fieldSearchRef}
                              value={fieldSearch}
                              onChange={(e) => setFieldSearch(e.target.value)}
                              placeholder="Buscar…"
                              className={`w-full py-2 pl-9 pr-3 text-sm ${cu.input}`}
                            />
                          </div>
                        </div>
                        <div className="max-h-[min(340px,50vh)] overflow-y-auto overscroll-contain p-1.5">
                          {aiFields.length > 0 ? (
                            <>
                              <p className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${cu.muted}`}>
                                Campos de IA
                              </p>
                              {aiFields.map((it) => (
                                <button
                                  key={it.id}
                                  type="button"
                                  role="option"
                                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-[#ececec] hover:bg-[#2a2a2a]"
                                  onClick={() => addFieldFromPicker(it)}
                                >
                                  <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-inner ${it.swatch}`}
                                    aria-hidden
                                  >
                                    <FieldGlyph id={it.id} />
                                  </span>
                                  {it.label}
                                </button>
                              ))}
                            </>
                          ) : null}
                          {allFields.length > 0 ? (
                            <>
                              <p className={`mt-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${cu.muted}`}>
                                Todos
                              </p>
                              {allFields.map((it) => (
                                <button
                                  key={it.id}
                                  type="button"
                                  role="option"
                                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-[#ececec] hover:bg-[#2a2a2a]"
                                  onClick={() => addFieldFromPicker(it)}
                                >
                                  <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-inner ${it.swatch}`}
                                    aria-hidden
                                  >
                                    <FieldGlyph id={it.id} />
                                  </span>
                                  {it.label}
                                </button>
                              ))}
                            </>
                          ) : null}
                          {filteredFields.length === 0 ? (
                            <p className={`px-3 py-6 text-center text-sm ${cu.muted}`}>Sin resultados</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {fields
                  .filter((row) => !HIDDEN_IN_FIELDS_PANEL.has(row.id))
                  .map((row) => (
                    <CustomFieldRowCard
                      key={row.id}
                      row={row}
                      onPatch={patchField}
                      onRemove={removeFieldRow}
                      removable={row.id !== SUITE_FIELD_CONTEXT_ID}
                    />
                  ))}
              </div>
            </div>

            <div className="mt-8 space-y-2">
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${cu.label}`}>Subtareas</p>
              <button
                type="button"
                onClick={() => onAddSubtask(task.id)}
                className="text-sm font-medium text-[#7eb6ff] hover:underline"
              >
                + Agregar subtarea
              </button>
            </div>

            <div className={`mt-8 rounded-xl border border-dashed ${cu.border} bg-[#141414] px-4 py-8 text-center`}>
              <p className={`text-sm ${cu.muted}`}>Adjuntos: arrastra archivos aquí (próximamente)</p>
            </div>

            <div className="mt-5">
              <p className={`mb-2 text-[11px] font-medium uppercase tracking-wide ${cu.label}`}>% Avance</p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="h-2 flex-1 cursor-pointer accent-[var(--suite-accent)]"
                />
                <span className="w-12 tabular-nums text-lg font-semibold text-white">{progress}%</span>
              </div>
            </div>
          </div>

          <aside
            className={`relative z-[2] flex min-h-0 min-w-0 flex-col border-t lg:min-h-0 lg:border-l lg:border-t-0 ${cu.border} ${cu.panel}`}
          >
            <div className={`relative shrink-0 border-b px-3 py-3 ${cu.border}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#ececec]">Actividad</span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#252525] hover:text-[#c4c4c4] ${activitySearchOpen ? "bg-[#252525] text-[#ececec]" : "text-[#7a7a7a]"}`}
                    title="Buscar en el historial"
                    aria-label="Buscar en actividad"
                    aria-pressed={activitySearchOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivitySearchOpen((v) => !v);
                      setActivityFilterOpen(false);
                      setActivityNotifOpen(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    ref={activityNotifBtnRef}
                    type="button"
                    className={`relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#252525] hover:text-[#c4c4c4] ${activityNotifOpen ? "bg-[#252525] text-[#ececec]" : "text-[#7a7a7a]"}`}
                    title="Recordatorios en esta tarea"
                    aria-label="Notificaciones y recordatorios"
                    aria-expanded={activityNotifOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivityNotifOpen((v) => !v);
                      setActivityFilterOpen(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.64 5.36 6 7.92 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {scheduledActivityCount > 0 ? (
                      <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--suite-accent)] px-1 text-[10px] font-bold leading-none text-white">
                        {scheduledActivityCount > 9 ? "9+" : scheduledActivityCount}
                      </span>
                    ) : null}
                  </button>
                  <button
                    ref={activityFilterBtnRef}
                    type="button"
                    className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#252525] hover:text-[#c4c4c4] ${activityFilterOpen ? "bg-[#252525] text-[#ececec]" : "text-[#7a7a7a]"}`}
                    title="Filtrar por tipo de actividad"
                    aria-label="Filtrar actividad"
                    aria-expanded={activityFilterOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivityFilterOpen((v) => !v);
                      setActivityNotifOpen(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
                    </svg>
                  </button>
                  <span className={`ml-1 text-xs ${cu.muted}`}>Historial</span>
                </div>
              </div>
              {activitySearchOpen ? (
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={activitySearchInputRef}
                    value={activitySearchQuery}
                    onChange={(e) => setActivitySearchQuery(e.target.value)}
                    placeholder="Buscar en actor, mensaje o fecha…"
                    className={`w-full ${cu.input}`}
                    aria-label="Texto a buscar en actividad"
                  />
                </div>
              ) : null}
              {activityFilterOpen ? (
                <div
                  ref={activityFilterPanelRef}
                  className="absolute right-3 top-full z-30 mt-1 w-[min(calc(100vw-2rem),280px)] overflow-hidden rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] py-2 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#2a2a2a] px-3 pb-2">
                    <span className="text-xs font-semibold text-[#ececec]">Actividades</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-[11px] font-medium text-[#7eb6ff] hover:underline"
                        onClick={() =>
                          setActivityKindEnabled({
                            field_change: false,
                            comment: false,
                            scheduled: false,
                            time_log: false,
                          })
                        }
                      >
                        Deseleccionar todo
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-medium text-[#7eb6ff] hover:underline"
                        onClick={() => setActivityKindEnabled(defaultActivityKindEnabled())}
                      >
                        Seleccionar todo
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {ACTIVITY_KIND_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[#ececec] hover:bg-[#2a2a2a]"
                        onClick={() =>
                          setActivityKindEnabled((prev) => ({ ...prev, [opt.id]: !prev[opt.id] }))
                        }
                      >
                        <span>{opt.label}</span>
                        {activityKindEnabled[opt.id] ? (
                          <span className="text-[#5b8cff]" aria-hidden>
                            ✓
                          </span>
                        ) : (
                          <span className="w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {activityNotifOpen ? (
                <div
                  ref={activityNotifPanelRef}
                  className="absolute right-11 top-full z-30 mt-1 w-[min(calc(100vw-2rem),300px)] overflow-hidden rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="border-b border-[#2a2a2a] px-3 py-2 text-xs font-semibold text-[#ececec]">Notificaciones</p>
                  <div className="max-h-56 space-y-2 overflow-y-auto px-3 py-2 text-xs leading-relaxed text-[#d0d0d0]">
                    {scheduledActivityCount > 0 ? (
                      <>
                        <p className={cu.muted}>
                          {scheduledActivityCount === 1
                            ? "Hay 1 recordatorio guardado en el historial de esta tarea."
                            : `Hay ${scheduledActivityCount} recordatorios en el historial.`}
                        </p>
                        <ul className="space-y-1.5 border-t border-[#2a2a2a] pt-2">
                          {sessionActivity
                            .filter((e) => e.kind === "scheduled")
                            .slice(0, 6)
                            .map((e) => (
                              <li key={e.id} className="rounded-md bg-[#141414] px-2 py-1.5">
                                <span className="line-clamp-2 text-[#ececec]">{e.message}</span>
                                <span className={`mt-0.5 block text-[10px] ${cu.muted}`}>
                                  {new Date(e.t).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </>
                    ) : (
                      <p className={cu.muted}>
                        No hay recordatorios en el historial de esta tarea. Las notificaciones push o por correo se
                        conectarán más adelante; aquí solo ves lo guardado en la actividad.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="suite-scroll pointer-events-auto flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
              {sessionActivity.length > 0 ? (
                <div className="space-y-3">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${cu.label}`}>Actividad</p>
                  {filteredSessionActivity.length === 0 ? (
                    <p className={`rounded-lg border border-dashed border-[#3d3d3d] px-3 py-4 text-center text-xs ${cu.muted}`}>
                      Ninguna entrada coincide con la búsqueda o el filtro de tipos.
                    </p>
                  ) : (
                    filteredSessionActivity.map((e) => (
                      <div
                        key={e.id}
                        className={`border-l-2 pl-3 ${
                          e.kind === "comment"
                            ? "border-violet-500/45"
                            : e.kind === "scheduled"
                              ? "border-amber-500/45"
                              : e.kind === "time_log"
                                ? "border-teal-500/50"
                                : "border-[#5b8cff]/55"
                        }`}
                      >
                        <p className="text-[#ececec]">
                          <span className="font-semibold text-white">{e.actor}</span>{" "}
                          <span className="text-[#d6d6d6]">{e.message}</span>
                        </p>
                        <p className={`mt-1 text-xs ${cu.muted}`}>
                          {new Date(e.t).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
              <div className="border-l-2 border-[#3d3d3d] pl-3">
                <p className={cu.muted}>Sistema</p>
                <p className="text-[#ececec]">Tarea sincronizada con el cronograma del proyecto.</p>
                <p className={`mt-1 text-xs ${cu.muted}`}>WBS {task.wbsCode ?? "—"} · Prioridad {priorityLabel}</p>
              </div>
              <div className="border-l-2 border-[#3d3d3d] pl-3">
                <p className={cu.muted}>Estado en el formulario</p>
                <p className="mt-1">
                  <span className={statusPill.className}>{statusPill.text}</span>
                </p>
                {status !== task.status ? (
                  <p className="mt-2 text-xs text-emerald-300/85">Se sincronizará el estado al cabo de unos segundos.</p>
                ) : null}
              </div>
              {task.updatedAt ? (
                <div className="border-l-2 border-[#3d3d3d] pl-3">
                  <p className={cu.muted}>Última actualización en servidor</p>
                  <p className="text-[#ececec]">
                    {new Date(task.updatedAt).toLocaleString("es-CL", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ) : null}
              {task.isCritical ? (
                <div className="border-l-2 border-rose-800/60 pl-3">
                  <p className="text-rose-300/90">Marcada como ruta crítica en datos PMO.</p>
                </div>
              ) : null}
            </div>
            <div className={`shrink-0 border-t p-3 ${cu.border}`}>
              <SuiteActivityComposer
                cu={{ input: cu.input, border: cu.border, muted: cu.muted, label: cu.label }}
                onPostComment={appendCommentActivity}
                onScheduleReminder={appendScheduleActivity}
              />
              <p className={`mt-2 text-[10px] ${cu.muted}`}>
                Comentarios, recordatorios y cambios recientes se guardan en la tarea. Hilos y adjuntos reales, más adelante.
              </p>
            </div>
          </aside>
        </div>

        <footer className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3 ${cu.border} bg-[#151515]`}>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {onDeleteTask ? (
              <button
                type="button"
                disabled={autosaveBusy || deleting}
                onClick={() => void handleDeleteTask()}
                className="rounded-lg border border-rose-900/60 bg-rose-950/35 px-3 py-2 text-sm text-rose-200 hover:bg-rose-950/55 disabled:opacity-50"
              >
                {deleting ? "Eliminando…" : "Eliminar tarea"}
              </button>
            ) : null}
            <span className={`max-w-[min(100%,440px)] truncate text-xs ${cu.muted}`}>
              {syncHint === "dirty"
                ? "Cambios pendientes de sincronizar…"
                : syncHint === "saving"
                  ? "Sincronizando con el servidor…"
                  : syncHint === "saved"
                    ? "Listo · sincronizado"
                    : syncHint === "error"
                      ? "Error al sincronizar (mensaje arriba)"
                      : !err
                        ? "Los cambios se guardan solos al editar."
                        : ""}
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} className={cu.btnGhost}>
              Cerrar
            </button>
          </div>
        </footer>
      </div>
      {priorityMenuOpen && priorityMenuGeom ? (
        <div
          ref={priorityMenuPanelRef}
          role="listbox"
          aria-label="Prioridad"
          className="fixed z-[140] overflow-y-auto overscroll-contain rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] py-1 shadow-2xl"
          style={{
            left: priorityMenuGeom.left,
            top: priorityMenuGeom.top,
            width: priorityMenuGeom.width,
            maxHeight: priorityMenuGeom.maxHeight,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#2a2a2a] px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#ececec]">
              <span className="shrink-0 text-lg leading-none">
                <PriorityFlag priority={priority} />
              </span>
              <span className="truncate">{labelPriorityHuman(priority)}</span>
            </span>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#9b9b9b] hover:bg-[#2a2a2a] hover:text-white"
              aria-label="Cerrar menú de prioridad"
              onClick={() => setPriorityMenuOpen(false)}
            >
              ×
            </button>
          </div>
          {PRIORITY_MENU_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={priorityMatchesMenu(priority, id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-[#ececec] hover:bg-[#2a2a2a]"
              onClick={() => {
                setPriority(id);
                setPriorityMenuOpen(false);
              }}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg leading-none">
                  <PriorityFlag priority={id} />
                </span>
                {labelPriorityHuman(id)}
              </span>
              {priorityMatchesMenu(priority, id) ? <span className="text-[#5b8cff]">✓</span> : <span className="w-4" />}
            </button>
          ))}
          <button
            type="button"
            className="flex w-full items-center gap-2 border-t border-[#2a2a2a] px-3 py-2.5 text-left text-sm text-[#c4c4c4] hover:bg-[#2a2a2a]"
            onClick={() => {
              setPriority("NORMAL");
              setPriorityMenuOpen(false);
            }}
          >
            <span className="text-base text-[#888]" aria-hidden>
              ⊘
            </span>
            Borrar (vuelve a Normal)
          </button>
          <div className={`border-t border-[#2a2a2a] px-3 py-2 ${cu.muted}`}>
            <span className="text-[11px]">Priorizar con IA (demo)</span>
          </div>
        </div>
      ) : null}
      {relationsOpen && relationsMenuGeom ? (
        <div
          ref={relationsMenuPanelRef}
          className="fixed z-[140] overflow-y-auto overscroll-contain rounded-xl border border-[#3d3d3d] bg-[#1a1a1a] shadow-2xl"
          style={{
            left: relationsMenuGeom.left,
            top: relationsMenuGeom.top,
            width: relationsMenuGeom.width,
            maxHeight: relationsMenuGeom.maxHeight,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {relationsStep === "menu" ? (
            <div className="p-3">
              <p className={`mb-2 text-xs font-semibold text-[#ececec]`}>Agrega una relación</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#333] bg-[#161616] px-2 py-4 text-center text-xs text-[#ececec] hover:border-[#555] hover:bg-[#1e1e1e]"
                  onClick={() => {
                    setRelationsStep("pick");
                    setRelationSearch("");
                  }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#252525] text-lg">✓</span>
                  Vincular / a la espera de
                </button>
                <button
                  type="button"
                  disabled
                  title="Próximamente: enlaces inversos"
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#141414] px-2 py-4 text-center text-xs text-[#555]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a1a1a] text-lg">−</span>
                  Bloqueo
                </button>
                <button
                  type="button"
                  disabled
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#141414] px-2 py-4 text-center text-xs text-[#555]"
                >
                  <span className="text-lg">📄</span>
                  Vincular documento
                </button>
                <button
                  type="button"
                  disabled
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#141414] px-2 py-4 text-center text-xs text-[#555]"
                >
                  <span className="text-lg">+</span>
                  Personalizada
                </button>
              </div>
              <p className={`mt-2 text-[10px] leading-snug ${cu.muted}`}>
                «A la espera de» define la dependencia directa de esta tarea respecto de otra del mismo proyecto.
              </p>
            </div>
          ) : (
            <div className="p-3">
              <button
                type="button"
                className={`mb-2 text-xs font-medium text-[#7eb6ff] hover:underline`}
                onClick={() => {
                  setRelationsStep("menu");
                  setRelationSearch("");
                }}
              >
                ← Volver
              </button>
              <p className="mb-2 text-xs font-semibold text-[#ececec]">Elegir tarea predecesora</p>
              <input
                value={relationSearch}
                onChange={(e) => setRelationSearch(e.target.value)}
                placeholder="Buscar por nombre o WBS…"
                className={`mb-2 w-full ${cu.input}`}
              />
              <div className="max-h-52 space-y-1 overflow-y-auto pr-0.5">
                {relationPickList.length === 0 ? (
                  <p className={`py-4 text-center text-xs ${cu.muted}`}>No hay otras tareas o ninguna coincide.</p>
                ) : (
                  relationPickList.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full flex-col items-start rounded-lg border border-transparent px-2 py-2 text-left hover:border-[#444] hover:bg-[#222]"
                      onClick={() => {
                        setDependencyTaskId(p.id);
                        setRelationsOpen(false);
                        setRelationsStep("menu");
                        setRelationSearch("");
                      }}
                    >
                      <span className="text-sm text-[#ececec]">
                        {p.wbsCode ? <span className="font-mono text-[#9b9b9b]">{p.wbsCode} · </span> : null}
                        {p.name}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                className={`mt-2 w-full ${cu.btnGhost}`}
                onClick={() => {
                  setDependencyTaskId("");
                  setRelationsOpen(false);
                  setRelationsStep("menu");
                  setRelationSearch("");
                }}
              >
                Quitar dependencia
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

  if (!portalEl) return null;
  return createPortal(shell, portalEl);
}
