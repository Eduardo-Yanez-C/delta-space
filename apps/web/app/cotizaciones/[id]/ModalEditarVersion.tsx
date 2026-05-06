"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { updateQuoteVersion, type QuoteVersionDetail } from "../../../lib/api";
import { STATUS_LABELS } from "../constants";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  version: QuoteVersionDetail | null;
  onSuccess: () => void;
};

export function ModalEditarVersion({
  open,
  onClose,
  quoteId,
  version,
  onSuccess,
}: Props) {
  const [status, setStatus] = useState("BORRADOR");
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<string>("");
  const [vatPercent, setVatPercent] = useState<string>("");
  const [globalMarginPercent, setGlobalMarginPercent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && version) {
      setStatus(version.status || "BORRADOR");
      setGlobalDiscountPercent(version.globalDiscountPercent != null ? String(version.globalDiscountPercent) : "");
      setVatPercent(version.vatPercent != null ? String(version.vatPercent) : "19");
      setGlobalMarginPercent(version.globalMarginPercent != null ? String(version.globalMarginPercent) : "");
      setError(null);
    }
  }, [open, version]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!version) return;
    setError(null);
    const body: { status?: string; globalDiscountPercent?: number; vatPercent?: number; globalMarginPercent?: number } = {};
    if (status) body.status = status;
    const gd = globalDiscountPercent.trim() !== "" ? parseFloat(globalDiscountPercent.replace(",", ".")) : undefined;
    if (gd !== undefined && !Number.isNaN(gd) && gd >= 0) body.globalDiscountPercent = gd;
    const vat = vatPercent.trim() !== "" ? parseFloat(vatPercent.replace(",", ".")) : undefined;
    if (vat !== undefined && !Number.isNaN(vat) && vat >= 0) body.vatPercent = vat;
    const gm = globalMarginPercent.trim() !== "" ? parseFloat(globalMarginPercent.replace(",", ".")) : undefined;
    if (gm !== undefined && !Number.isNaN(gm)) body.globalMarginPercent = gm;
    setSaving(true);
    updateQuoteVersion(quoteId, version.id, body)
      .then(() => {
        onSuccess();
        onClose();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al actualizar versión");
      })
      .finally(() => setSaving(false));
  };

  if (!version) return null;

  return (
    <Modal open={open} onClose={onClose} title="Parámetros de versión" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
          <select
            className="input-field"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descuento global (%)</label>
          <input
            type="text"
            inputMode="decimal"
            className="input-field"
            placeholder="Ej. 0"
            value={globalDiscountPercent}
            onChange={(e) => setGlobalDiscountPercent(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">IVA (%)</label>
          <input
            type="text"
            inputMode="decimal"
            className="input-field"
            placeholder="Ej. 19"
            value={vatPercent}
            onChange={(e) => setVatPercent(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-500">
            Margen global (%) — secundario
          </label>
          <input
            type="text"
            inputMode="decimal"
            className="input-field"
            placeholder="Opcional"
            value={globalMarginPercent}
            onChange={(e) => setGlobalMarginPercent(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
