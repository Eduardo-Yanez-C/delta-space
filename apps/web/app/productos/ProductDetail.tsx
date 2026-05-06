"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCan } from "../../lib/useCan";
import {
  fetchProduct,
  deactivateProduct,
  activateProduct,
  deleteProduct,
  type Product,
} from "../../lib/api";
import { SuccessBanner } from "../../components/ui/SuccessBanner";
import { CommercialStatusBadge, SupplyOriginBadge } from "../../components/ui/Badge";
import { ProductSuppliersSection } from "./ProductSuppliersSection";
import { ProductPricesSection } from "./ProductPricesSection";
import { ShareEntityToChatModal } from "../../components/conversations/ShareEntityToChatModal";

const PANEL_SLUGS = ["paneles-fotovoltaicos"];
const INVERTER_SLUGS = ["inversores-on-grid", "inversores-hibridos", "inversores-off-grid"];
const BATTERY_SLUG = "baterias";

function getSpecKind(slug: string | undefined): "panel" | "inverter" | "battery" | null {
  if (!slug) return null;
  if (PANEL_SLUGS.includes(slug)) return "panel";
  if (INVERTER_SLUGS.includes(slug)) return "inverter";
  if (slug === BATTERY_SLUG) return "battery";
  return null;
}

function SpecCell({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/90 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

export function ProductDetail({
  id,
  /** Desde Logística / inventario: barra de retorno y botón principal hacia inventario (no solo catálogo Ventas). */
  suiteInventoryBackHref,
}: {
  id: string;
  suiteInventoryBackHref?: string;
}) {
  const router = useRouter();
  const canEdit = useCan("edit", "product");
  const canDelete = useCan("delete", "product");
  const canManageSuppliers = useCan("manage_suppliers", "product");
  const canAddPrice = useCan("add_price", "product");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    fetchProduct(id)
      .then(setProduct)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  const refresh = () => {
    fetchProduct(id).then(setProduct);
  };

  const handleDesactivar = async () => {
    if (!window.confirm("¿Desactivar este producto? Se marcará como Descontinuado y no aparecerá en opciones activas. Podrá reactivarlo después.")) return;
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(true);
    try {
      const updated = await deactivateProduct(id);
      setProduct(updated);
      setActionSuccess("Producto desactivado: queda como descontinuado y fuera de listados activos. Puede reactivarlo cuando quiera.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "No se pudo desactivar el producto");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivar = async () => {
    if (!window.confirm("¿Reactivar este producto? Volverá a estar disponible como activo.")) return;
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(true);
    try {
      const updated = await activateProduct(id);
      setProduct(updated);
      setActionSuccess("Producto reactivado correctamente.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "No se pudo reactivar el producto");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEliminar = async () => {
    if (
      !window.confirm(
        "¿Eliminar permanentemente este producto del catálogo?\n\n" +
          "En cotizaciones o plantillas donde ya figuraba, la referencia al producto se quitará pero el texto de la línea se conserva.\n\n" +
          "Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(true);
    try {
      await deleteProduct(id);
      router.push("/productos?success=deleted");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "No se pudo eliminar el producto");
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500 dark:text-slate-400">Cargando producto…</span>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
        {error ?? "Producto no encontrado"}
        <Link
          href={suiteInventoryBackHref ?? "/productos"}
          className="btn-secondary mt-3 inline-block"
        >
          {suiteInventoryBackHref ? "Volver a inventario" : "Volver a productos"}
        </Link>
      </div>
    );
  }

  const hasNacional = product.productSuppliers?.some(
    (ps) => ps.supplier?.supplyOrigin === "NACIONAL"
  );
  const hasInternacional = product.productSuppliers?.some(
    (ps) => ps.supplier?.supplyOrigin === "INTERNACIONAL"
  );

  const specKind = getSpecKind(product.category?.slug);
  const brandLine = product.brandNameFree ?? product.brand?.name ?? null;
  const modelLine = product.modelNameFree ?? product.model?.name ?? null;

  return (
    <div className="space-y-4">
      {suiteInventoryBackHref ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200">
          <span className="font-medium">Vista desde Logística.</span>{" "}
          <Link href={suiteInventoryBackHref} className="font-semibold text-primary-600 underline dark:text-primary-400">
            Volver a inventario
          </Link>
          <span className="mx-1.5 text-slate-400">·</span>
          <Link href="/productos" className="text-primary-600/90 underline dark:text-primary-400/90">
            Abrir este producto en el catálogo comercial
          </Link>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Esta ficha es el catálogo comercial. Un <strong className="font-medium text-slate-700 dark:text-slate-300">nombre de producto</strong> que venga solo en la planilla OQC se guarda en la fila de inventario (serial); ábrala desde la tabla para verlo o editarlo.
          </p>
        </div>
      ) : null}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">{product.name}</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {[product.internalCode, product.sku].filter(Boolean).join(" · ") || "Sin código interno / SKU"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CommercialStatusBadge status={product.commercialStatus} />
              {product.category?.name && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {product.category.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap gap-2">
            {canEdit && (
              <Link href={`/productos/${id}/editar`} className="btn-primary">
                Editar
              </Link>
            )}
            {canEdit && product.commercialStatus === "ACTIVO" && (
              <button type="button" onClick={handleDesactivar} disabled={actionLoading} className="btn-secondary">
                {actionLoading ? "…" : "Desactivar"}
              </button>
            )}
            {canEdit && product.commercialStatus === "DESCONTINUADO" && (
              <button type="button" onClick={handleReactivar} disabled={actionLoading} className="btn-secondary">
                {actionLoading ? "…" : "Reactivar"}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleEliminar}
                disabled={actionLoading}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                Eliminar
              </button>
            )}
            {suiteInventoryBackHref ? (
              <Link href={suiteInventoryBackHref} className="btn-secondary">
                Inventario
              </Link>
            ) : null}
            <Link href="/productos" className="btn-secondary">
              {suiteInventoryBackHref ? "Catálogo ventas" : "Listado"}
            </Link>
            <button type="button" className="btn-secondary" onClick={() => setShareOpen(true)}>
              Compartir
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <SuccessBanner message={actionSuccess} onDismiss={() => setActionSuccess(null)} />
      )}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200" role="alert">
          {actionError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <h3 className="mb-3 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Datos generales
          </h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Descripción</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{product.description || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Unidad</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                {product.unit}
                {product.purchaseUnit ? ` (compra: ${product.purchaseUnit})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Moneda base</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{product.defaultCurrency ?? "—"}</dd>
            </div>
            {product.technicalSheetUrl && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Ficha técnica</dt>
                <dd className="mt-0.5">
                  <a
                    href={product.technicalSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 hover:underline dark:text-amber-400"
                  >
                    Abrir enlace
                  </a>
                </dd>
              </div>
            )}
            {product.warranty && (
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Garantía</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{product.warranty}</dd>
              </div>
            )}
            {product.origin && (
              <div>
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Origen</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{product.origin}</dd>
              </div>
            )}
            {product.internalNotes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Notas internas</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{product.internalNotes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="mb-3 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Clasificación y abastecimiento
          </h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Marca</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{brandLine ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Modelo</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{modelLine ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Fabricante real</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{product.realManufacturer || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Proveedor principal</dt>
              <dd>
                {product.primarySupplier ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{product.primarySupplier.name}</span>
                    <SupplyOriginBadge origin={product.primarySupplier.supplyOrigin} />
                    <span className="text-xs text-slate-500">
                      {[product.primarySupplier.country, product.primarySupplier.city].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500">Sin proveedor principal.</span>
                )}
              </dd>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {hasNacional && (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                  Opción nacional
                </span>
              )}
              {hasInternacional && (
                <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                  Opción internacional
                </span>
              )}
            </div>
          </dl>
        </div>
      </div>

      {specKind && (
        <div className="card p-4 sm:p-5">
          <h3 className="mb-3 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Ficha técnica
          </h3>
          {specKind === "panel" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {product.panelSpecs ? (
                <>
                  <SpecCell label="Potencia (W)" value={product.panelSpecs.powerW} />
                  <SpecCell label="Eficiencia (%)" value={product.panelSpecs.efficiencyPercent} />
                  <SpecCell label="Vmp (V)" value={product.panelSpecs.vmpV} />
                  <SpecCell label="Imp (A)" value={product.panelSpecs.impA} />
                  <SpecCell label="Voc (V)" value={product.panelSpecs.vocV} />
                  <SpecCell label="Isc (A)" value={product.panelSpecs.iscA} />
                  <SpecCell label="Bifacialidad (%)" value={product.panelSpecs.bifacialityPercent} />
                  <SpecCell label="Tipo de célula" value={product.panelSpecs.cellType} />
                  <SpecCell
                    label="Dimensiones (mm)"
                    value={
                      product.panelSpecs.lengthMm != null && product.panelSpecs.widthMm != null
                        ? `${product.panelSpecs.lengthMm} × ${product.panelSpecs.widthMm}`
                        : null
                    }
                  />
                  <SpecCell label="Peso (kg)" value={product.panelSpecs.weightKg} />
                </>
              ) : (
                <p className="col-span-full text-sm text-slate-500">
                  Sin datos de ficha técnica. {canEdit && "Edite el producto para completar."}
                </p>
              )}
            </div>
          )}
          {specKind === "inverter" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {product.inverterSpecs ? (
                <>
                  <SpecCell label="Tipo" value={product.inverterSpecs.inverterType} />
                  <SpecCell label="Potencia AC (W)" value={product.inverterSpecs.powerAcW} />
                  <SpecCell label="Tensión máx. PV (V)" value={product.inverterSpecs.maxPvVoltageV} />
                  <SpecCell label="Tensión arranque (V)" value={product.inverterSpecs.startupVoltageV} />
                  <SpecCell
                    label="Rango MPPT (V)"
                    value={
                      product.inverterSpecs.mpptVoltageMinV != null && product.inverterSpecs.mpptVoltageMaxV != null
                        ? `${product.inverterSpecs.mpptVoltageMinV} – ${product.inverterSpecs.mpptVoltageMaxV}`
                        : null
                    }
                  />
                  <SpecCell label="Corriente DC máx. (A)" value={product.inverterSpecs.maxDcCurrentA} />
                  <SpecCell label="Eficiencia (%)" value={product.inverterSpecs.efficiencyPercent} />
                  <SpecCell label="Conexión" value={product.inverterSpecs.connectionType} />
                  <SpecCell label="Protección IP" value={product.inverterSpecs.ipRating} />
                  <SpecCell label="Comunicación" value={product.inverterSpecs.communication} />
                </>
              ) : (
                <p className="col-span-full text-sm text-slate-500">
                  Sin datos de ficha técnica. {canEdit && "Edite el producto para completar."}
                </p>
              )}
            </div>
          )}
          {specKind === "battery" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {product.batterySpecs ? (
                <>
                  <SpecCell label="Capacidad (kWh)" value={product.batterySpecs.capacityKwh} />
                  <SpecCell label="Tensión nominal (V)" value={product.batterySpecs.nominalVoltageV} />
                  <SpecCell label="Potencia carga/desc. (W)" value={product.batterySpecs.maxChargeDischargePowerW} />
                  <SpecCell label="Química" value={product.batterySpecs.chemistry} />
                  <SpecCell label="Ciclos" value={product.batterySpecs.cycles} />
                  <SpecCell label="Peso (kg)" value={product.batterySpecs.weightKg} />
                  <SpecCell label="Dimensiones" value={product.batterySpecs.dimensionsMm} />
                </>
              ) : (
                <p className="col-span-full text-sm text-slate-500">
                  Sin datos de ficha técnica. {canEdit && "Edite el producto para completar."}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <ProductSuppliersSection productId={id} onUpdate={refresh} canManage={canManageSuppliers} />

      <ProductPricesSection productId={id} canAddPrice={canAddPrice} />
      <ShareEntityToChatModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        entityType="PRODUCT"
        title={product.name}
        sourceEntityId={product.id}
        snapshot={{
          name: product.name,
          category: product.category?.name ?? null,
          brand: product.brandNameFree ?? product.brand?.name ?? null,
          model: product.modelNameFree ?? product.model?.name ?? null,
          unit: product.unit,
          commercialStatus: product.commercialStatus,
        }}
        proposedImport={{
          name: product.name,
          categoryId: product.categoryId,
          unit: product.unit,
          description: product.description ?? null,
        }}
      />
    </div>
  );
}
