"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { updateQuoteItem, type QuoteItemDto } from "../../../lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  versionId: string;
  item: QuoteItemDto | null;
  canPriceOverride: boolean;
  onSuccess: () => void;
  isMarginQuote?: boolean;
};

export function ModalEditarItem({
  open,
  onClose,
  quoteId,
  versionId,
  item,
  canPriceOverride,
  onSuccess,
  isMarginQuote = false,
}: Props) {
  const [quantity, setQuantity] = useState(1);
  const [unitPriceOverride, setUnitPriceOverride] = useState("");
  const [unitCostSnapshot, setUnitCostSnapshot] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && item) {
      setQuantity(item.quantity);
      setUnitPriceOverride("");
      setUnitCostSnapshot(
        item.unitCostSnapshot != null && item.unitCostSnapshot !== undefined ? String(item.unitCostSnapshot) : "",
      );
      setDiscountPercent(item.discountPercentSnapshot ?? 0);
      setError(null);
    }
  }, [open, item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setError(null);
    if (quantity < 1) {
      setError("Cantidad debe ser al menos 1.");
      return;
    }
    const body: {
      quantity: number;
      discountPercent?: number;
      unitPriceOverride?: number;
      unitCostSnapshot?: number | null;
    } = {
      quantity,
      discountPercent: Math.min(100, Math.max(0, Number(discountPercent) || 0)),
    };
    if (canPriceOverride && unitPriceOverride.trim() !== "") {
      const override = parseFloat(unitPriceOverride.replace(",", "."));
      if (!Number.isNaN(override) && override >= 0) body.unitPriceOverride = override;
    }
    if (isMarginQuote) {
      const c = unitCostSnapshot.trim();
      if (c === "") body.unitCostSnapshot = null;
      else {
        const cost = parseFloat(c.replace(",", "."));
        if (Number.isNaN(cost) || cost < 0) {
          setError("Costo unitario debe ser ≥ 0 o vacío para quitar.");
          return;
        }
        body.unitCostSnapshot = cost;
      }
    }
    setSaving(true);
    updateQuoteItem(quoteId, versionId, item.id, body)
      .then(() => {
        onSuccess();
        onClose();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al actualizar ítem");
      })
      .finally(() => setSaving(false));
  };

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} title="Editar ítem" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <p className="text-sm text-slate-600">{item.productNameSnapshot}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad</label>
            <input
              type="number"
              min={1}
              className="input-field"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descuento línea (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              className="input-field"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        {isMarginQuote && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Costo unitario (MARGIN)
            </label>
            <input
              type="text"
              inputMode="decimal"
              className="input-field"
              value={unitCostSnapshot}
              onChange={(e) => setUnitCostSnapshot(e.target.value)}
              placeholder="Vacío = sin costo"
            />
          </div>
        )}
        {canPriceOverride && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Override de precio unitario (opcional)
            </label>
            <input
              type="text"
              inputMode="decimal"
              className="input-field"
              placeholder={`Actual: ${item.currencySnapshot} ${item.unitPriceSnapshot}`}
              value={unitPriceOverride}
              onChange={(e) => setUnitPriceOverride(e.target.value)}
            />
          </div>
        )}
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
