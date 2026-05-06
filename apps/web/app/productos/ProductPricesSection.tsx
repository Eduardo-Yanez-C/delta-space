"use client";

import { useEffect, useState } from "react";
import { formatDate, formatNumber } from "../../lib/format";
import { parseLocaleMoneyNumber } from "../../lib/chile-inputs";
import { fetchProductPrices, fetchProductSuppliers, createPrice, type ProductPrice } from "../../lib/api";
import { SupplyOriginBadge } from "../../components/ui/Badge";
import { MoneyThousandsInput } from "../../components/ui/MoneyThousandsInput";

type SupplierOption = { id: string; name: string; supplyOrigin: string };

export function ProductPricesSection({
  productId,
  canAddPrice: canAddPriceProp = false,
  /** Si true, abre de inicio el formulario “Nuevo registro de precio” (flujo alta de producto). */
  initialExpandNewPriceForm = false,
}: {
  productId: string;
  canAddPrice?: boolean;
  initialExpandNewPriceForm?: boolean;
}) {
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(initialExpandNewPriceForm);
  const [form, setForm] = useState({
    price: "",
    cost: "",
    purchasePrice: "",
    currency: "CLP",
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: "",
    supplierId: "",
    quoteReference: "",
    validityIndicator: "",
    logisticCostEstimate: "",
    customsCostEstimate: "",
    totalLandedCost: "",
    supplierDiscountPercent: "",
    suggestedMarginPercent: "",
  });

  useEffect(() => {
    if (!productId || !showForm) return;
    fetchProductSuppliers(productId).then((list) =>
      setSupplierOptions(
        (list || [])
          .filter((ps) => ps.supplier)
          .map((ps) => ({
            id: ps.supplierId,
            name: (ps.supplier as { name: string }).name,
            supplyOrigin: (ps.supplier as { supplyOrigin: string }).supplyOrigin,
          }))
      )
    );
  }, [productId, showForm]);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchProductPrices(productId)
      .then(setPrices)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseLocaleMoneyNumber(form.price.trim());
    if (price == null || price <= 0) {
      setError("Precio de venta es obligatorio y debe ser mayor a 0.");
      return;
    }
    setError(null);
    try {
      const num = (raw: string) => {
        const t = raw.trim();
        if (!t) return undefined;
        const n = parseLocaleMoneyNumber(t);
        return n != null && !Number.isNaN(n) ? n : undefined;
      };
      await createPrice({
        productId,
        supplierId: form.supplierId || undefined,
        price,
        cost: num(form.cost),
        purchasePrice: num(form.purchasePrice),
        currency: form.currency || "CLP",
        validFrom: form.validFrom,
        validTo: form.validTo || undefined,
        quoteReference: form.quoteReference.trim() || undefined,
        validityIndicator: form.validityIndicator.trim() || undefined,
        logisticCostEstimate: num(form.logisticCostEstimate),
        customsCostEstimate: num(form.customsCostEstimate),
        totalLandedCost: num(form.totalLandedCost),
        supplierDiscountPercent: form.supplierDiscountPercent ? Number(form.supplierDiscountPercent) : undefined,
        suggestedMarginPercent: form.suggestedMarginPercent ? Number(form.suggestedMarginPercent) : undefined,
      });
      setShowForm(false);
      setForm({
        price: "",
        cost: "",
        purchasePrice: "",
        currency: "CLP",
        validFrom: new Date().toISOString().slice(0, 10),
        validTo: "",
        supplierId: "",
        quoteReference: "",
        validityIndicator: "",
        logisticCostEstimate: "",
        customsCostEstimate: "",
        totalLandedCost: "",
        supplierDiscountPercent: "",
        suggestedMarginPercent: "",
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear precio");
    }
  };

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Historial de precios
        </h3>
        {canAddPriceProp && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            Agregar nuevo precio
          </button>
        )}
      </div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/40"
        >
          <h4 className="mb-3 font-medium text-slate-900 dark:text-slate-100">Nuevo registro de precio</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {supplierOptions.length > 0 && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Proveedor</label>
                <select
                  value={form.supplierId}
                  onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
                  className="input-field"
                >
                  <option value="">Sin asignar</option>
                  {supplierOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplyOrigin})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Precio venta *</label>
              <MoneyThousandsInput
                value={form.price}
                onValueChange={(price) => setForm((f) => ({ ...f, price }))}
                required
                aria-label="Precio de venta"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Costo / Compra</label>
              <MoneyThousandsInput
                value={form.cost}
                onValueChange={(cost) => setForm((f) => ({ ...f, cost }))}
                aria-label="Costo o compra"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Moneda</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Vigencia desde *</label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Vigencia hasta</label>
              <input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Referencia cotización</label>
              <input
                type="text"
                value={form.quoteReference}
                onChange={(e) => setForm((f) => ({ ...f, quoteReference: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Costo logístico</label>
              <MoneyThousandsInput
                value={form.logisticCostEstimate}
                onValueChange={(logisticCostEstimate) =>
                  setForm((f) => ({ ...f, logisticCostEstimate }))
                }
                aria-label="Costo logístico estimado"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Costo aduanero</label>
              <MoneyThousandsInput
                value={form.customsCostEstimate}
                onValueChange={(customsCostEstimate) =>
                  setForm((f) => ({ ...f, customsCostEstimate }))
                }
                aria-label="Costo aduanero estimado"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Total puesto destino</label>
              <MoneyThousandsInput
                value={form.totalLandedCost}
                onValueChange={(totalLandedCost) => setForm((f) => ({ ...f, totalLandedCost }))}
                aria-label="Total puesto en destino"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="btn-primary">
              Crear precio
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="text-slate-500">Cargando precios…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Proveedor / Origen</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Moneda</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Compra</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Venta</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Vigencia</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Logístico</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Aduanero</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Total destino</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Referencia</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Indicador vigencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
              {prices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                    Aún no hay precios cargados. Agregue el primero con el botón superior.
                  </td>
                </tr>
              ) : (
                prices.map((pr) => (
                  <tr key={pr.id}>
                    <td className="px-4 py-2">
                      <div>
                        <span className="font-medium text-slate-900 dark:text-slate-100 dark:text-slate-100">
                          {pr.supplier?.name ?? "—"}
                        </span>
                        {pr.supplier && (
                          <div className="mt-0.5">
                            <SupplyOriginBadge origin={pr.supplier.supplyOrigin} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{pr.currency}</td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {formatNumber(pr.purchasePrice ?? pr.cost, 2)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatNumber(pr.price, 2)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {formatDate(pr.validFrom)} → {formatDate(pr.validTo)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {formatNumber(pr.logisticCostEstimate, 2)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {formatNumber(pr.customsCostEstimate, 2)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {formatNumber(pr.totalLandedCost, 2)}
                    </td>
                    <td className="px-4 py-2 text-slate-600 max-w-[120px] truncate">
                      {pr.quoteReference ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600 max-w-[100px] truncate">
                      {pr.validityIndicator ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
