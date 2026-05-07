"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import {
  fetchProducts,
  fetchProductPrices,
  addQuoteItem,
  createLine,
  type Product,
  type ProductPrice,
} from "../../../lib/api";
import { formatDate, formatMoney } from "../constants";
import { onMoneyIntegerInputChange, parseLocaleMoneyNumber } from "../../../lib/chile-inputs";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  versionId: string;
  currency: string | null;
  canPriceOverride: boolean;
  onSuccess: () => void;
  /** Si se indica, se agrega una línea jerárquica bajo este ítem principal en lugar de un ítem plano. */
  mainItemId?: string;
};

export function ModalAgregarProducto({
  open,
  onClose,
  quoteId,
  versionId,
  currency,
  canPriceOverride,
  onSuccess,
  mainItemId,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedPriceId, setSelectedPriceId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPriceOverride, setUnitPriceOverride] = useState<string>("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingProducts(true);
    fetchProducts({ commercialStatus: "ACTIVO" })
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
    setSelectedProductId("");
    setSelectedPriceId("");
    setPrices([]);
    setQuantity(1);
    setUnitPriceOverride("");
    setDiscountPercent(0);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || !selectedProductId) {
      setPrices([]);
      setSelectedPriceId("");
      return;
    }
    setLoadingPrices(true);
    fetchProductPrices(selectedProductId)
      .then((list) => {
        setPrices(list);
        setSelectedPriceId("");
      })
      .catch(() => setPrices([]))
      .finally(() => setLoadingPrices(false));
  }, [open, selectedProductId]);

  const selectedPrice = prices.find((p) => p.id === selectedPriceId);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedProductId || quantity < 1) {
      setError("Seleccione producto y cantidad válida.");
      return;
    }
    const priceToUse = selectedPriceId || undefined;
    const body: {
      productId: string;
      priceId?: string;
      quantity: number;
      discountPercent?: number;
      unitPriceOverride?: number;
    } = {
      productId: selectedProductId,
      quantity,
      discountPercent: Math.min(100, Math.max(0, Number(discountPercent) || 0)),
    };
    if (priceToUse) body.priceId = priceToUse;
    if (canPriceOverride && unitPriceOverride.trim() !== "") {
      const override = parseLocaleMoneyNumber(unitPriceOverride.trim());
      if (override != null && override >= 0) body.unitPriceOverride = override;
    }
    setSaving(true);
    const promise = mainItemId
      ? createLine(quoteId, versionId, mainItemId, {
          source: "FROM_CATALOG",
          productId: body.productId,
          quantity: body.quantity,
          priceId: body.priceId,
          unitPriceOverride: body.unitPriceOverride,
        })
      : addQuoteItem(quoteId, versionId, body);
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
      title={mainItemId ? "Agregar línea desde catálogo" : "Agregar ítem desde producto"}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Producto</label>
          <select
            className="input-field"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            required
          >
            <option value="">Seleccione producto</option>
            {loadingProducts ? (
              <option disabled>Cargando…</option>
            ) : (
              products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.internalCode ?? p.id})
                </option>
              ))
            )}
          </select>
        </div>

        {selectedProductId && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Precio (proveedor, moneda, vigencia)</label>
            <select
              className="input-field"
              value={selectedPriceId}
              onChange={(e) => setSelectedPriceId(e.target.value)}
            >
              <option value="">— Usar precio vigente por defecto —</option>
              {loadingPrices ? (
                <option disabled>Cargando precios…</option>
              ) : (
                prices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.supplier?.name ?? "Sin proveedor"} · {p.currency} {formatMoney(p.price)} · Vigencia: {formatDate(p.validFrom)} – {formatDate(p.validTo) || "abierto"}
                  </option>
                ))
              )}
            </select>
            {prices.length === 0 && !loadingPrices && (
              <p className="mt-1 text-xs text-amber-600">No hay precios cargados para este producto.</p>
            )}
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

        {canPriceOverride && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Override de precio unitario (opcional)
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="input-field"
              placeholder={selectedPrice ? `${currency ?? ""} ${selectedPrice.price}` : "Precio venta"}
              value={unitPriceOverride}
              onChange={(e) =>
                setUnitPriceOverride(
                  currency === "CLP" ? onMoneyIntegerInputChange(e.target.value) : e.target.value,
                )
              }
            />
            <p className="mt-1 text-xs text-slate-500">
              Solo si tiene permiso de override de precio. Dejar vacío para usar el precio del catálogo.
            </p>
          </div>
        )}

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
