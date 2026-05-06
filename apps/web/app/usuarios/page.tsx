"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SuccessBanner } from "../../components/ui/SuccessBanner";
import { useCan } from "../../lib/useCan";
import { UsuariosList } from "./UsuariosList";

export default function UsuariosPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const canCreate = useCan("create", "users");

  return (
    <div className="space-y-6">
      {success === "created" && (
        <SuccessBanner message="Usuario creado correctamente." dismissHref="/usuarios" />
      )}
      {success === "updated" && (
        <SuccessBanner message="Usuario actualizado correctamente." dismissHref="/usuarios" />
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Administración de usuarios y asignación de roles.{" "}
          <span className="text-slate-500">Pulse una fila para abrir el panel de esa persona.</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/usuarios/panel"
            className="inline-flex rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/40"
          >
            Panel y dashboards
          </Link>
          {canCreate && (
            <Link href="/usuarios/nuevo" className="btn-primary">
              Nuevo usuario
            </Link>
          )}
        </div>
      </div>
      <UsuariosList />
    </div>
  );
}
