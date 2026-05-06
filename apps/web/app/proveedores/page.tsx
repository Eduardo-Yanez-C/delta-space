"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCan } from "../../lib/useCan";
import { SuccessBanner } from "../../components/ui/SuccessBanner";
import { ProveedoresList } from "./ProveedoresList";

export default function ProveedoresPage() {
  const canCreate = useCan("create", "supplier");
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  return (
    <div className="space-y-6">
      {success === "created" && (
        <SuccessBanner message="Proveedor creado correctamente." dismissHref="/proveedores" />
      )}
      {success === "updated" && (
        <SuccessBanner message="Proveedor actualizado correctamente." dismissHref="/proveedores" />
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Abastecimiento nacional e internacional para el catálogo.
        </p>
        {canCreate && (
          <Link href="/proveedores/nuevo" className="btn-primary">
            Nuevo proveedor
          </Link>
        )}
      </div>
      <ProveedoresList />
    </div>
  );
}
