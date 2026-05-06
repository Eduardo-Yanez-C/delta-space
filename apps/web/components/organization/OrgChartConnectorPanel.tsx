"use client";

import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import type { OrgBuiltinLineStyles, OrgStrokeStyle } from "../../lib/org-chart-line-styles";
import { saveOrgBuiltinLineStyles } from "../../lib/org-chart-line-styles";

export type OrgCustomEdgeDto = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  color: string;
  strokeWidth: number;
  dashPattern: string | null;
  midOffsetX?: number;
  midOffsetY?: number;
};

export type OrgLinesLabels = {
  hierarchyTitle: string;
  advisoryTitle: string;
  color: string;
  width: string;
  dashStyle: string;
  dashSolid: string;
  dashDashed: string;
  dashDotted: string;
  freeSection: string;
  from: string;
  to: string;
  add: string;
  delete: string;
  emptyEdges: string;
  readOnly: string;
};

type DashPreset = "solid" | "dashed" | "dotted";

function dashPresetValue(p: DashPreset): string {
  if (p === "solid") return "";
  if (p === "dashed") return "8 6";
  return "2 5";
}

function presetFromDashArray(dash: string): DashPreset {
  const t = dash.trim();
  if (!t) return "solid";
  if (t.startsWith("2 ")) return "dotted";
  return "dashed";
}

/** Formulario compacto (sin envoltorio modal). */
export function OrgLinesSettingsForm({
  nodes,
  freeEdges,
  builtinStyles,
  onBuiltinStylesChange,
  canEdit,
  onAddEdge,
  onDeleteEdge,
  labels,
}: {
  nodes: { id: string; name: string; role: string }[];
  freeEdges: OrgCustomEdgeDto[];
  builtinStyles: OrgBuiltinLineStyles;
  onBuiltinStylesChange: (s: OrgBuiltinLineStyles) => void;
  canEdit: boolean;
  onAddEdge: (payload: {
    fromNodeId: string;
    toNodeId: string;
    color: string;
    strokeWidth: number;
    dashPattern: string | null;
  }) => Promise<void>;
  onDeleteEdge: (id: string) => Promise<void>;
  labels: OrgLinesLabels;
}) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [feColor, setFeColor] = useState("#64748b");
  const [feWidth, setFeWidth] = useState(2);
  const [feDash, setFeDash] = useState<DashPreset>("solid");
  const [busy, setBusy] = useState(false);

  const nodeOpts = useMemo(() => nodes.map((n) => ({ id: n.id, label: `${n.name} — ${n.role}` })), [nodes]);

  function applyHierarchy(patch: Partial<OrgStrokeStyle>) {
    const next = { ...builtinStyles, hierarchy: { ...builtinStyles.hierarchy, ...patch } };
    saveOrgBuiltinLineStyles(next);
    onBuiltinStylesChange(next);
  }

  function applyAdvisory(patch: Partial<OrgStrokeStyle>) {
    const next = { ...builtinStyles, advisory: { ...builtinStyles.advisory, ...patch } };
    saveOrgBuiltinLineStyles(next);
    onBuiltinStylesChange(next);
  }

  async function submitFree() {
    if (!fromId || !toId || fromId === toId) return;
    setBusy(true);
    try {
      await onAddEdge({
        fromNodeId: fromId,
        toNodeId: toId,
        color: feColor,
        strokeWidth: feWidth,
        dashPattern: feDash === "solid" ? null : dashPresetValue(feDash),
      });
      setToId("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-[11px] text-[var(--pmo-text)]">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] p-2">
          <p className="text-[9px] font-bold uppercase text-[var(--pmo-text-muted)]">{labels.hierarchyTitle}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <input
              type="color"
              value={builtinStyles.hierarchy.stroke.startsWith("#") ? builtinStyles.hierarchy.stroke : "#1e293b"}
              disabled={!canEdit}
              onChange={(e) => applyHierarchy({ stroke: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-[var(--pmo-border)] disabled:opacity-50"
              title={labels.color}
            />
            <input
              type="number"
              min={0.5}
              max={8}
              step={0.25}
              value={builtinStyles.hierarchy.strokeWidth}
              disabled={!canEdit}
              onChange={(e) => applyHierarchy({ strokeWidth: Number(e.target.value) || 2 })}
              className="w-14 rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-1 py-0.5 text-[10px] disabled:opacity-50"
              title={labels.width}
            />
            <select
              value={presetFromDashArray(builtinStyles.hierarchy.dashArray)}
              disabled={!canEdit}
              onChange={(e) => applyHierarchy({ dashArray: dashPresetValue(e.target.value as DashPreset) })}
              className="min-w-0 flex-1 rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-1 py-0.5 text-[10px] disabled:opacity-50"
              title={labels.dashStyle}
            >
              <option value="solid">{labels.dashSolid}</option>
              <option value="dashed">{labels.dashDashed}</option>
              <option value="dotted">{labels.dashDotted}</option>
            </select>
          </div>
        </div>
        <div className="rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] p-2">
          <p className="text-[9px] font-bold uppercase text-[var(--pmo-text-muted)]">{labels.advisoryTitle}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <input
              type="color"
              value={builtinStyles.advisory.stroke.startsWith("#") ? builtinStyles.advisory.stroke : "#4f46e5"}
              disabled={!canEdit}
              onChange={(e) => applyAdvisory({ stroke: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-[var(--pmo-border)] disabled:opacity-50"
              title={labels.color}
            />
            <input
              type="number"
              min={0.5}
              max={8}
              step={0.25}
              value={builtinStyles.advisory.strokeWidth}
              disabled={!canEdit}
              onChange={(e) => applyAdvisory({ strokeWidth: Number(e.target.value) || 2 })}
              className="w-14 rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-1 py-0.5 text-[10px] disabled:opacity-50"
              title={labels.width}
            />
            <select
              value={presetFromDashArray(builtinStyles.advisory.dashArray)}
              disabled={!canEdit}
              onChange={(e) => applyAdvisory({ dashArray: dashPresetValue(e.target.value as DashPreset) })}
              className="min-w-0 flex-1 rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-1 py-0.5 text-[10px] disabled:opacity-50"
              title={labels.dashStyle}
            >
              <option value="solid">{labels.dashSolid}</option>
              <option value="dashed">{labels.dashDashed}</option>
              <option value="dotted">{labels.dashDotted}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-indigo-200/70 bg-indigo-50/40 p-2 dark:border-indigo-900 dark:bg-indigo-950/30">
        <p className="text-[9px] font-bold uppercase text-indigo-950 dark:text-indigo-100">{labels.freeSection}</p>
        {!canEdit ? <p className="mt-1 text-[10px] text-[var(--pmo-text-muted)]">{labels.readOnly}</p> : null}
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <label className="block text-[9px] font-bold uppercase text-[var(--pmo-text-muted)]">
            {labels.from}
            <select
              value={fromId}
              disabled={!canEdit}
              onChange={(e) => setFromId(e.target.value)}
              className="mt-0.5 w-full rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-1 py-1 text-[10px] disabled:opacity-50"
            >
              <option value="">—</option>
              {nodeOpts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[9px] font-bold uppercase text-[var(--pmo-text-muted)]">
            {labels.to}
            <select
              value={toId}
              disabled={!canEdit}
              onChange={(e) => setToId(e.target.value)}
              className="mt-0.5 w-full rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-1 py-1 text-[10px] disabled:opacity-50"
            >
              <option value="">—</option>
              {nodeOpts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="color" value={feColor} disabled={!canEdit} onChange={(e) => setFeColor(e.target.value)} className="h-6 w-8 rounded border disabled:opacity-50" />
          <input
            type="number"
            min={0.5}
            max={8}
            step={0.25}
            value={feWidth}
            disabled={!canEdit}
            onChange={(e) => setFeWidth(Number(e.target.value) || 2)}
            className="w-14 rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-1 py-0.5 text-[10px] disabled:opacity-50"
          />
          <select
            value={feDash}
            disabled={!canEdit}
            onChange={(e) => setFeDash(e.target.value as DashPreset)}
            className="rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-1 py-0.5 text-[10px] disabled:opacity-50"
          >
            <option value="solid">{labels.dashSolid}</option>
            <option value="dashed">{labels.dashDashed}</option>
            <option value="dotted">{labels.dashDotted}</option>
          </select>
          <button
            type="button"
            disabled={!canEdit || !fromId || !toId || fromId === toId || busy}
            onClick={() => void submitFree()}
            className="pmo-btn-primary ml-auto px-2 py-0.5 text-[10px] font-bold disabled:opacity-50"
          >
            {labels.add}
          </button>
        </div>
      </div>

      {freeEdges.length === 0 ? (
        <p className="text-[10px] text-[var(--pmo-text-muted)]">{labels.emptyEdges}</p>
      ) : (
        <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded border border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] p-1.5">
          {freeEdges.map((e) => {
            const fa = nodes.find((n) => n.id === e.fromNodeId);
            const ta = nodes.find((n) => n.id === e.toNodeId);
            return (
              <li key={e.id} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{fa?.name ?? e.fromNodeId}</span>
                  <span className="text-[var(--pmo-text-muted)]"> → </span>
                  <span className="font-semibold">{ta?.name ?? e.toNodeId}</span>
                </span>
                <button
                  type="button"
                  disabled={!canEdit || busy}
                  onClick={() => void onDeleteEdge(e.id)}
                  className="shrink-0 rounded border border-red-200 px-1 py-0.5 text-[9px] font-bold text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-200"
                >
                  {labels.delete}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function OrgLinesModal({
  open,
  onClose,
  title,
  closeLabel,
  ...formProps
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
} & ComponentProps<typeof OrgLinesSettingsForm>) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3">
      <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" aria-label={closeLabel} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(88dvh,680px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--pmo-border)] bg-[var(--pmo-surface)] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--pmo-border)] bg-[var(--pmo-surface-2)] px-3 py-2">
          <h2 className="text-sm font-bold text-[var(--pmo-text)]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-[var(--pmo-border)] bg-[var(--pmo-surface)] px-2 py-0.5 text-xs font-semibold hover:bg-[var(--pmo-row-hover)]">
            {closeLabel}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <OrgLinesSettingsForm {...formProps} />
        </div>
      </div>
    </div>
  );
}
