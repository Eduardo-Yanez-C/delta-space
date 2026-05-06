"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ProductDetail } from "../ProductDetail";
import { SuccessBanner } from "../../../components/ui/SuccessBanner";

export default function ProductoDetallePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const success = searchParams.get("success");

  return (
    <div className="space-y-4">
      {success === "updated" && (
        <SuccessBanner message="Producto actualizado correctamente." dismissHref={`/productos/${id}`} />
      )}
      <ProductDetail id={id} />
    </div>
  );
}
