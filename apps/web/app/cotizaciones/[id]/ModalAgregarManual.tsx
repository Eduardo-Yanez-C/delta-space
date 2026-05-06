"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { addQuoteItem, createLine } from "../../../lib/api";
import { onMoneyIntegerInputChange, parseLocaleMoneyNumber } from "../../../lib/chile-inputs";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  versionId: string;
  defaultCurrency: string;
  onSuccess: () => void;
  /** Si se indica, se agrega una línea jerárquica bajo este ítem principal en lugar de un ítem plano. */
  mainItemId?: string;
  /** Muestra costo unitario al crear línea bajo un bloque (solo backend aplica en MARGIN). */
  isMarginQuote?: boolean;
};

export function ModalAgregarManual({
  open,
  onClose,
  quoteId,
  versionId,
  defaultCurrency,
  onSuccess,
  mainItemId,
  isMarginQuote = false,
}: Props) {
  const [productNameSnapshot, setProductNameSnapshot] = useState("");
  const [productDescriptionSnapshot, setProductDescriptionSnapshot] = useState("");
  const [categoryNameSnapshot, setCategoryNameSnapshot] = useState("");
  const [brandNameSnapshot, setBrandNameSnapshot] = useState("");
  const [modelNameSnapshot, setModelNameSnapshot] = useState("");
  const [currencySnapshot, setCurrencySnapshot] = useState(defaultCurrency || "CLP");
  const [unitPriceSnapshot, setUnitPriceSnapshot] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [unitCostSnapshot, setUnitCostSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showMarginCost = Boolean(mainItemId && isMarginQuote);

  useEffect(() => {
    if (open) {
      setCurrencySnapshot(defaultCurrency || "CLP");
      setQuantity(1);
      setUnitPriceSnapshot("");
      setUnitCostSnapshot("");
      setDiscountPercent(0);
      setProductNameSnapshot("");
      setProductDescriptionSnapshot("");
      setCategoryNameSnapshot("");
      setBrandNameSnapshot("");
      setModelNameSnapshot("");
      setError(null);
    }
  }, [open, defaultCurrency]);

  const fmtMoneyTyping = (raw: string) =>
    currencySnapshot === "CLP" ? onMoneyIntegerInputChange(raw) : raw;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = productNameSnapshot.trim();
    if (!name) {
      setError("El nombre del ítem es obligatorio.");
      return;
    }
    const price = parseLocaleMoneyNumber(unitPriceSnapshot);
    if (price == null || price < 0) {
      setError("Precio unitario debe ser un número válido.");
      return;
    }
    if (quantity < 1) {
      setError("Cantidad debe ser al menos 1.");
      return;
    }
    let resolvedUnitCost: number | null = null;
    if (showMarginCost) {
      const c = unitCostSnapshot.trim();
      if (c !== "") {
        const cost = parseLocaleMoneyNumber(c);
        if (cost == null || cost < 0) {
          setError("Costo unitario debe ser un número ≥ 0 o vacío (sin costo).");
          return;
        }
        resolvedUnitCost = cost;
      }
    }
    setSaving(true);
    const promise = mainItemId
      ? createLine(quoteId, versionId, mainItemId, {
          source: "MANUAL",
          productNameSnapshot: name,
          productDescriptionSnapshot: productDescriptionSnapshot.trim() || undefined,
          quantity,
          unitPriceSnapshot: price,
          discountPercentSnapshot: discountPercent || undefined,
          currencySnapshot: currencySnapshot || "CLP",
          ...(showMarginCost ? { unitCostSnapshot: resolvedUnitCost } : {}),
        })
      : addQuoteItem(quoteId, versionId, {
          quantity,
          discountPercent: discountPercent || undefined,
          productNameSnapshot: name,
          productDescriptionSnapshot: productDescriptionSnapshot.trim() || undefined,
          categoryNameSnapshot: categoryNameSnapshot.trim() || undefined,
          brandNameSnapshot: brandNameSnapshot.trim() || undefined,
          modelNameSnapshot: modelNameSnapshot.trim() || undefined,
          currencySnapshot: currencySnapshot || "CLP",
          unitPriceSnapshot: price,
        });
    promise
      .then(() => {
        onSuccess();
        onClose();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al agregar ítem");
      })
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mainItemId ? "Agregar línea manual" : "Agregar ítem manual"}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre del ítem *</label>
          <input
            type="text"
            className="input-field"
            value={productNameSnapshot}
            onChange={(e) => setProductNameSnapshot(e.target.value)}
            required
            placeholder="Ej: Instalación, mano de obra..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
          <textarea
            className="input-field min-h-[60px]"
            value={productDescriptionSnapshot}
            onChange={(e) => setProductDescriptionSnapshot(e.target.value)}
            rows={2}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Categoría</label>
            <input
              type="text"
              className="input-field"
              value={categoryNameSnapshot}
              onChange={(e) => setCategoryNameSnapshot(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Marca</label>
            <input
              type="text"
              className="input-field"
              value={brandNameSnapshot}
              onChange={(e) => setBrandNameSnapshot(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Modelo</label>
            <input
              type="text"
              className="input-field"
              value={modelNameSnapshot}
              onChange={(e) => setModelNameSnapshot(e.target.value)}
            />
          </div>
        </div>
        {showMarginCost && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Costo unitario (MARGIN)
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="input-field"
              value={unitCostSnapshot}
              onChange={(e) => setUnitCostSnapshot(fmtMoneyTyping(e.target.value))}
              placeholder="Vacío = sin costo"
            />
            <p className="mt-1 text-xs text-slate-500">
              Opcional. Misma lógica que al editar la línea: utilidad y margen % sobre el total de la línea.
            </p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Precio unitario *</label>
            <input
              type="text"
              inputMode="numeric"
              className="input-field"
              value={unitPriceSnapshot}
              onChange={(e) => setUnitPriceSnapshot(fmtMoneyTyping(e.target.value))}
              required
              placeholder="0"
            />
          </div>
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
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Agregando…" : mainItemId ? "Agregar línea" : "Agregar ítem"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
