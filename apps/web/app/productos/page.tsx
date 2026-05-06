"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCan } from "../../lib/useCan";
import { SuccessBanner } from "../../components/ui/SuccessBanner";
import { ProductosList } from "./ProductosList";

export default function ProductosPage() {
  const canCreate = useCan("create", "product");
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  return (
    <div className="space-y-6">
      {success === "created" && (
        <SuccessBanner message="Producto creado correctamente." dismissHref="/productos" />
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Catálogo comercial y técnico para cotizaciones fotovoltaicas.
        </p>
        {canCreate && (
          <Link href="/productos/nuevo" className="btn-primary">
            Nuevo producto
          </Link>
        )}
      </div>
      <ProductosList />
    </div>
  );
}
