"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCan } from "../../../lib/useCan";
import { CotizacionForm } from "../CotizacionForm";
import { createQuote } from "../../../lib/api";

export default function NuevaCotizacionMargenPage() {
  const router = useRouter();
  const canCreate = useCan("create", "quote");

  useEffect(() => {
    if (!canCreate) router.replace("/acceso-restringido");
  }, [canCreate, router]);

  if (!canCreate) return null;

  return (
    <div className="card p-6">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">Nueva cotización (margen)</h2>
      <p className="mb-6 text-sm text-slate-600">
        Alta mínima con <code className="rounded bg-slate-100 px-1 text-xs">quoteKind: MARGIN</code>. El flujo contable de margen se amplía en etapas posteriores.
      </p>
      <CotizacionForm
        mode="create"
        enableMarginTechnicalBasics
        onSubmit={async (data) => {
          const quote = await createQuote({ ...data, quoteKind: "MARGIN" });
          router.push(`/cotizaciones/${quote.id}?success=created-margin`);
        }}
      />
    </div>
  );
}
