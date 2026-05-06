"use client";

import { useState } from "react";
import { updateMainItem, type QuoteMainItemDto, type UpdateMainItemInput } from "../../../lib/api";

type Props = {
  quoteId: string;
  versionId: string;
  mainItem: QuoteMainItemDto;
  onSaved: () => void;
  onCancel: () => void;
};

function initialOverrideStr(item: QuoteMainItemDto): string {
  if (item.totalOverride != null && item.totalOverride !== undefined) {
    return String(item.totalOverride);
  }
  if (item.totalMode === "MANUAL") {
    return String(item.total);
  }
  return "";
}

export function MainItemBlockHeaderForm({ quoteId, versionId, mainItem, onSaved, onCancel }: Props) {
  const [name, setName] = useState(mainItem.name);
  const [description, setDescription] = useState(mainItem.description ?? "");
  const [visibleInFinalQuote, setVisibleInFinalQuote] = useState(mainItem.visibleInFinalQuote);
  const [totalMode, setTotalMode] = useState<"SUM_LINES" | "MANUAL">(
    mainItem.totalMode === "MANUAL" ? "MANUAL" : "SUM_LINES",
  );
  const [totalOverrideStr, setTotalOverrideStr] = useState(initialOverrideStr(mainItem));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nameTrim = name.trim();
    if (!nameTrim) {
      setError("El nombre del bloque es obligatorio.");
      return;
    }

    const body: UpdateMainItemInput = {
      name: nameTrim,
      description: description.trim(),
      visibleInFinalQuote,
      totalMode,
    };

    if (totalMode === "MANUAL") {
      const raw = totalOverrideStr.trim();
      const o = raw === "" ? 0 : parseFloat(raw.replace(",", "."));
      if (Number.isNaN(o) || o < 0) {
        setError("Total manual debe ser un número mayor o igual a 0.");
        return;
      }
      body.totalOverride = o;
    }

    setSaving(true);
    updateMainItem(quoteId, versionId, mainItem.id, body)
      .then(() => {
        onSaved();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al guardar el bloque");
      })
      .finally(() => setSaving(false));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-lg border border-amber-200/80 bg-white/90 p-3 dark:border-amber-800/50 dark:bg-slate-900/60"
      onClick={(e) => e.stopPropagation()}
    >
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Nombre del bloque</label>
          <input
            type="text"
            className="input-field py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Descripción</label>
          <textarea
            className="input-field min-h-[52px] py-1.5 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Total del bloque</label>
          <select
            className="input-field py-1.5 text-sm"
            value={totalMode}
            onChange={(e) => {
              const m = e.target.value as "SUM_LINES" | "MANUAL";
              setTotalMode(m);
              if (m === "MANUAL" && mainItem.totalMode === "SUM_LINES") {
                setTotalOverrideStr(String(mainItem.total));
              }
            }}
          >
            <option value="SUM_LINES">Suma de líneas</option>
            <option value="MANUAL">Manual</option>
          </select>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {totalMode === "SUM_LINES"
              ? "El total comercial del grupo se calcula sumando las líneas."
              : "El total comercial del grupo es el valor indicado abajo."}
          </p>
        </div>
        {totalMode === "MANUAL" && (
          <div>
            <label className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Total manual</label>
            <input
              type="text"
              inputMode="decimal"
              className="input-field py-1.5 text-sm"
              value={totalOverrideStr}
              onChange={(e) => setTotalOverrideStr(e.target.value)}
              placeholder="0"
            />
          </div>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={visibleInFinalQuote}
          onChange={(e) => setVisibleInFinalQuote(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">Visible en PDF / vista previa</span>
      </label>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-2 dark:border-slate-600">
        <button type="button" onClick={onCancel} className="btn-secondary px-3 py-1.5 text-sm" disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary px-3 py-1.5 text-sm" disabled={saving}>
          {saving ? "Guardando…" : "Guardar bloque"}
        </button>
      </div>
    </form>
  );
}
