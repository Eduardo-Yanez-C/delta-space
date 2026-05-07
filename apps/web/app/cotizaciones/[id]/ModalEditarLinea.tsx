"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { updateLine, type QuoteItemLineDto } from "../../../lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  versionId: string;
  line: QuoteItemLineDto | null;
  onSuccess: () => void;
  /** Cotización MARGIN: permite editar costo unitario y se envía en el PATCH. */
  isMarginQuote?: boolean;
};

export function ModalEditarLinea({
  open,
  onClose,
  quoteId,
  versionId,
  line,
  onSuccess,
  isMarginQuote = false,
}: Props) {
  const [quantity, setQuantity] = useState(1);
  const [unitPriceSnapshot, setUnitPriceSnapshot] = useState("");
  const [unitCostSnapshot, setUnitCostSnapshot] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [productNameSnapshot, setProductNameSnapshot] = useState("");
  const [productDescriptionSnapshot, setProductDescriptionSnapshot] = useState("");
  const [currencySnapshot, setCurrencySnapshot] = useState("CLP");
  const [visibleInFinalQuote, setVisibleInFinalQuote] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && line) {
      setQuantity(line.quantity);
      setUnitPriceSnapshot(String(line.unitPriceSnapshot));
      setUnitCostSnapshot(
        line.unitCostSnapshot != null && line.unitCostSnapshot !== undefined
          ? String(line.unitCostSnapshot)
          : "",
      );
      setDiscountPercent(line.discountPercentSnapshot ?? 0);
      setProductNameSnapshot(line.productNameSnapshot ?? "");
      setProductDescriptionSnapshot(line.productDescriptionSnapshot ?? "");
      setCurrencySnapshot(line.currencySnapshot ?? "CLP");
      setVisibleInFinalQuote(line.visibleInFinalQuote ?? false);
      setError(null);
    }
  }, [open, line]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!line) return;
    setError(null);
    if (quantity < 1) {
      setError("Cantidad debe ser al menos 1.");
      return;
    }
    const price = parseFloat(unitPriceSnapshot.replace(",", "."));
    if (Number.isNaN(price) || price < 0) {
      setError("Precio unitario debe ser un número mayor o igual a 0.");
      return;
    }
    const body: {
      quantity: number;
      unitPriceSnapshot: number;
      discountPercentSnapshot?: number;
      productNameSnapshot?: string;
      productDescriptionSnapshot?: string;
      currencySnapshot?: string;
      visibleInFinalQuote?: boolean;
      unitCostSnapshot?: number | null;
    } = {
      quantity,
      unitPriceSnapshot: price,
      discountPercentSnapshot: Math.min(100, Math.max(0, Number(discountPercent) || 0)),
      visibleInFinalQuote,
    };
    if (isMarginQuote) {
      const c = unitCostSnapshot.trim();
      if (c === "") body.unitCostSnapshot = null;
      else {
        const cost = parseFloat(c.replace(",", "."));
        if (Number.isNaN(cost) || cost < 0) {
          setError("Costo unitario debe ser un número ≥ 0 o vacío para quitar.");
          return;
        }
        body.unitCostSnapshot = cost;
      }
    }
    const nameTrim = productNameSnapshot.trim();
    if (nameTrim) body.productNameSnapshot = nameTrim;
    body.productDescriptionSnapshot = productDescriptionSnapshot.trim() || undefined;
    if (currencySnapshot.trim()) body.currencySnapshot = currencySnapshot.trim();
    setSaving(true);
    updateLine(quoteId, versionId, line.id, body)
      .then(() => {
        onSuccess();
        onClose();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al actualizar línea");
      })
      .finally(() => setSaving(false));
  };

  if (!line) return null;

  return (
    <Modal open={open} onClose={onClose} title="Editar línea" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
          <input
            type="text"
            className="input-field"
            value={productNameSnapshot}
            onChange={(e) => setProductNameSnapshot(e.target.value)}
            placeholder="Nombre del producto o ítem"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
          <textarea
            className="input-field min-h-[50px]"
            value={productDescriptionSnapshot}
            onChange={(e) => setProductDescriptionSnapshot(e.target.value)}
            rows={2}
          />
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
            <p className="mt-1 text-xs text-slate-500">Se usa para utilidad y margen % sobre el total de la línea.</p>
          </div>
        )}
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
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Precio unitario</label>
            <input
              type="text"
              inputMode="decimal"
              className="input-field"
              value={unitPriceSnapshot}
              onChange={(e) => setUnitPriceSnapshot(e.target.value)}
              required
              placeholder="0"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Moneda</label>
            <select
              className="input-field"
              value={currencySnapshot}
              onChange={(e) => setCurrencySnapshot(e.target.value)}
            >
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>
        <div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={visibleInFinalQuote}
              onChange={(e) => setVisibleInFinalQuote(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Visible en PDF / vista previa</span>
          </label>
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
