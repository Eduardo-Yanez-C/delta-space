"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCan } from "../../lib/useCan";
import { SuccessBanner } from "../../components/ui/SuccessBanner";
import { ClientesList } from "./ClientesList";

export default function ClientesPage() {
  const canCreate = useCan("create", "client");
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  return (
    <div className="space-y-6">
      {success === "created" && (
        <SuccessBanner message="Cliente creado correctamente." dismissHref="/clientes" />
      )}
      {success === "updated" && (
        <SuccessBanner message="Cliente actualizado correctamente." dismissHref="/clientes" />
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Listado de clientes. Crear, editar o eliminar.
        </p>
        {canCreate && (
          <Link href="/clientes/nuevo" className="btn-primary">
            Nuevo cliente
          </Link>
        )}
      </div>
      <ClientesList />
    </div>
  );
}
