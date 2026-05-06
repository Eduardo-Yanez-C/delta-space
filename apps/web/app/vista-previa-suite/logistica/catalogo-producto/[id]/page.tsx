"use client";

import { useParams } from "next/navigation";
import { ProductDetail } from "../../../../productos/ProductDetail";

const INVENTARIO = "/vista-previa-suite/logistica/inventario";

/** Ficha de catálogo abierta desde Logística: mantiene el menú en Logística (no en Ventas como `/productos/...`). */
export default function LogisticaCatalogoProductoPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] ?? "" : "";

  if (!id) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        Identificador de producto no válido.
      </div>
    );
  }

  return <ProductDetail id={id} suiteInventoryBackHref={INVENTARIO} />;
}
