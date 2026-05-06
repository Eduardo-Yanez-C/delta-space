"use client";

import Link from "next/link";
import { useCan } from "../../lib/useCan";
import { CotizacionesList } from "./CotizacionesList";

export default function CotizacionesPage() {
  const canCreate = useCan("create", "quote");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Listado de cotizaciones versionadas. Crear nueva o editar cabecera.
        </p>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Link href="/cotizaciones/nueva" className="btn-primary">
              Nueva cotización
            </Link>
            <Link href="/cotizaciones/nueva-margen" className="btn-secondary" title="Cotización tipo margen (visibilidad extendida a vendedor asignado)">
              Nueva (margen)
            </Link>
            <Link href="/cotizaciones/desde-plantilla" className="btn-secondary">
              Desde plantilla
            </Link>
          </div>
        )}
      </div>
      <CotizacionesList />
    </div>
  );
}
