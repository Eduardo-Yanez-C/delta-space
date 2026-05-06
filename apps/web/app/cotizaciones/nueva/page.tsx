"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCan } from "../../../lib/useCan";
import { CotizacionForm } from "../CotizacionForm";
import { createQuote } from "../../../lib/api";

export default function NuevaCotizacionPage() {
  const router = useRouter();
  const canCreate = useCan("create", "quote");

  useEffect(() => {
    if (!canCreate) router.replace("/acceso-restringido");
  }, [canCreate, router]);

  if (!canCreate) return null;

  return (
    <div className="card p-6">
      <h2 className="mb-6 text-lg font-semibold text-slate-900">Nueva cotización</h2>
      <CotizacionForm
        mode="create"
        onSubmit={async (data) => {
          const quote = await createQuote(data);
          router.push(`/cotizaciones/${quote.id}?success=created`);
        }}
      />
    </div>
  );
}
