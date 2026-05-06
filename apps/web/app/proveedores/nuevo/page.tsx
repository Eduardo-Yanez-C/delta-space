"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCan } from "../../../lib/useCan";
import { SupplierForm } from "../SupplierForm";
import { createSupplier } from "../../../lib/api";

export default function NuevoProveedorPage() {
  const router = useRouter();
  const canCreate = useCan("create", "supplier");
  useEffect(() => {
    if (!canCreate) router.replace("/acceso-restringido");
  }, [canCreate, router]);
  if (!canCreate) return null;
  return (
    <div className="card p-6">
      <SupplierForm
        mode="create"
        onSubmit={async (data) => {
          await createSupplier(data);
          router.push("/proveedores?success=created");
        }}
      />
    </div>
  );
}
