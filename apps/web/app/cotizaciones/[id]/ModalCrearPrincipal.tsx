"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { createMainItem } from "../../../lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  versionId: string;
  onSuccess: () => void;
};

export function ModalCrearPrincipal({
  open,
  onClose,
  quoteId,
  versionId,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [totalMode, setTotalMode] = useState<"SUM_LINES" | "MANUAL">("SUM_LINES");
  const [visibleInFinalQuote, setVisibleInFinalQuote] = useState(true);
  const [totalOverride, setTotalOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setTotalMode("SUM_LINES");
      setVisibleInFinalQuote(true);
      setTotalOverride("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nameTrim = name.trim();
    if (!nameTrim) {
      setError("El nombre del ítem principal es obligatorio.");
      return;
    }
    const data: {
      name: string;
      description?: string;
      totalMode: string;
      visibleInFinalQuote: boolean;
      totalOverride?: number;
    } = {
      name: nameTrim,
      description: description.trim() || undefined,
      totalMode,
      visibleInFinalQuote,
    };
    if (totalMode === "MANUAL") {
      const override = totalOverride.trim() === "" ? undefined : parseFloat(totalOverride.replace(",", "."));
      if (override !== undefined && (Number.isNaN(override) || override < 0)) {
        setError("Total manual debe ser un número mayor o igual a 0.");
        return;
      }
      data.totalOverride = override ?? 0;
    }
    setSaving(true);
    createMainItem(quoteId, versionId, data)
      .then(() => {
        onSuccess();
        onClose();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al crear ítem principal");
      })
      .finally(() => setSaving(false));
  };

  return (
    <Modal open={open} onClose={onClose} title="Crear ítem principal" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre *</label>
          <input
            type="text"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ej: Paneles solares, Adicionales..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
          <textarea
            className="input-field min-h-[60px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Total del ítem</label>
          <select
            className="input-field"
            value={totalMode}
            onChange={(e) => setTotalMode(e.target.value as "SUM_LINES" | "MANUAL")}
          >
            <option value="SUM_LINES">Suma de líneas</option>
            <option value="MANUAL">Manual</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {totalMode === "SUM_LINES"
              ? "El total se calculará sumando las líneas que agregue debajo."
              : "Indique el total manualmente."}
          </p>
        </div>
        {totalMode === "MANUAL" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Total manual</label>
            <input
              type="text"
              inputMode="decimal"
              className="input-field"
              value={totalOverride}
              onChange={(e) => setTotalOverride(e.target.value)}
              placeholder="0"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="visibleInFinalQuote"
            checked={visibleInFinalQuote}
            onChange={(e) => setVisibleInFinalQuote(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label htmlFor="visibleInFinalQuote" className="text-sm text-slate-700 dark:text-slate-300">
            Visible en PDF / vista previa
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Creando…" : "Crear ítem principal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
