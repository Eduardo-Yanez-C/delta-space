"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCan } from "../../../lib/useCan";
import {
  buildLogisticaInventarioLinkProductHref,
  CATALOG_FLOW_FROM_LOGISTICA_INVENTORY,
  QUERY_INVENTORY_PROJECT_ID,
} from "../../../lib/catalog-inventory-flow";
import { ProductForm } from "../ProductForm";
import { ProductPricesSection } from "../ProductPricesSection";
import { createProduct, fetchProduct, fetchProductPrices, type Product } from "../../../lib/api";

const PENDING_PRICE_PARAM = "pendingPriceFor";

function NuevoProductoPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useCan("create", "product");
  const canAddPrice = useCan("add_price", "product");
  const [createdProduct, setCreatedProduct] = useState<Product | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const pendingIdFromUrl = searchParams.get(PENDING_PRICE_PARAM)?.trim() ?? "";
  const flowFrom = searchParams.get("from")?.trim() ?? "";
  const inventoryProjectIdParam = searchParams.get(QUERY_INVENTORY_PROJECT_ID)?.trim() ?? "";
  const returnToLogisticaInventory = flowFrom === CATALOG_FLOW_FROM_LOGISTICA_INVENTORY;

  const inventarioAfterPriceHref = useMemo(() => {
    if (!createdProduct?.id || !returnToLogisticaInventory) return "";
    return buildLogisticaInventarioLinkProductHref(
      createdProduct.id,
      inventoryProjectIdParam || null,
    );
  }, [createdProduct?.id, returnToLogisticaInventory, inventoryProjectIdParam]);

  useEffect(() => {
    if (!createdProduct) return;
    const id = window.setTimeout(() => {
      document.getElementById("paso-precio-obligatorio")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(id);
  }, [createdProduct?.id]);

  /** Recuperar paso 2 tras recarga, deep link o remount (URL es fuente de verdad). */
  useEffect(() => {
    if (!pendingIdFromUrl) return;
    if (createdProduct?.id === pendingIdFromUrl) return;
    let cancelled = false;
    setHydrating(true);
    fetchProduct(pendingIdFromUrl)
      .then((prod) => {
        if (!cancelled) setCreatedProduct(prod);
      })
      .catch(() => {
        if (!cancelled) {
          setCreatedProduct(null);
          router.replace("/productos/nuevo", { scroll: false });
        }
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pendingIdFromUrl, createdProduct?.id, router]);

  useEffect(() => {
    if (!canCreate && !pendingIdFromUrl) router.replace("/acceso-restringido");
  }, [canCreate, pendingIdFromUrl, router]);

  /** Paso 2: no bloquear por permiso de “crear” si ya hay producto pendiente (evita pantalla en blanco). */
  if (createdProduct || (pendingIdFromUrl && hydrating)) {
    if (pendingIdFromUrl && hydrating && !createdProduct) {
      return (
        <div className="card flex items-center justify-center p-12">
          <p className="text-slate-600">Cargando paso de precios…</p>
        </div>
      );
    }
    if (createdProduct) {
      return (
        <div className="space-y-4" id="paso-precio-obligatorio">
          <div className="card border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950/40">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
              Paso 2 de 2 — obligatorio
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Producto creado: {createdProduct.name}
            </h2>
            <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">
              Debe registrar <strong>al menos un precio de venta</strong> abajo. Hasta entonces el alta no está
              completa: use &quot;Ir a la ficha del producto&quot; solo después de crear el precio.
            </p>
            {returnToLogisticaInventory ? (
              <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                Luego use <strong className="font-normal">Volver a inventario para vincular stock</strong> y complete
                cantidad y destino en el mismo modal de ítem (un solo canal de catálogo: ficha + precio aquí).
              </p>
            ) : null}
          </div>
          <ProductPricesSection
            productId={createdProduct.id}
            canAddPrice={canAddPrice}
            initialExpandNewPriceForm
          />
          {!canAddPrice && (
            <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
              No tiene permiso para agregar precios. Solicite el permiso o que otro usuario complete este paso.
            </p>
          )}
          {finishError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {finishError}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={finishing}
              className="btn-primary disabled:opacity-50"
              onClick={async () => {
                setFinishError(null);
                setFinishing(true);
                try {
                  const list = await fetchProductPrices(createdProduct.id);
                  if (list.length === 0) {
                    setFinishError("Registre al menos un precio de venta antes de continuar.");
                    return;
                  }
                  router.push(`/productos/${createdProduct.id}`);
                } catch (e) {
                  setFinishError(e instanceof Error ? e.message : "Error al verificar precios");
                } finally {
                  setFinishing(false);
                }
              }}
            >
              {finishing ? "Comprobando…" : "Ir a la ficha del producto"}
            </button>
            {returnToLogisticaInventory && inventarioAfterPriceHref ? (
              <button
                type="button"
                disabled={finishing}
                className="btn-secondary disabled:opacity-50"
                onClick={async () => {
                  setFinishError(null);
                  setFinishing(true);
                  try {
                    const list = await fetchProductPrices(createdProduct.id);
                    if (list.length === 0) {
                      setFinishError("Registre al menos un precio de venta antes de continuar.");
                      return;
                    }
                    router.push(inventarioAfterPriceHref);
                  } catch (e) {
                    setFinishError(e instanceof Error ? e.message : "Error al verificar precios");
                  } finally {
                    setFinishing(false);
                  }
                }}
              >
                {finishing ? "Comprobando…" : "Volver a inventario para vincular stock"}
              </button>
            ) : null}
            <button type="button" className="btn-secondary" onClick={() => router.push("/productos")}>
              Volver al listado (alta incompleta)
            </button>
          </div>
        </div>
      );
    }
  }

  if (!canCreate) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        <strong>Paso 1 de 2:</strong> datos del producto. Al guardar pasará al paso de precio (obligatorio).
      </div>
      <div className="card p-6">
        <ProductForm
          mode="create"
          onSubmit={async (data) => {
            const p = await createProduct(data);
            setCreatedProduct(p);
            const q = new URLSearchParams();
            q.set(PENDING_PRICE_PARAM, p.id);
            if (flowFrom) q.set("from", flowFrom);
            if (inventoryProjectIdParam) q.set(QUERY_INVENTORY_PROJECT_ID, inventoryProjectIdParam);
            router.replace(`/productos/nuevo?${q.toString()}`, { scroll: false });
          }}
        />
      </div>
    </div>
  );
}

export default function NuevoProductoPage() {
  return (
    <Suspense
      fallback={
        <div className="card flex items-center justify-center p-12">
          <p className="text-slate-600">Cargando…</p>
        </div>
      }
    >
      <NuevoProductoPageInner />
    </Suspense>
  );
}
