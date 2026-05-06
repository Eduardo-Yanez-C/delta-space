"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCan } from "../../../lib/useCan";
import { ClienteForm } from "../ClienteForm";
import { createClient } from "../../../lib/api";

export default function NuevoClientePage() {
  const router = useRouter();
  const canCreate = useCan("create", "client");
  useEffect(() => {
    if (!canCreate) router.replace("/acceso-restringido");
  }, [canCreate, router]);
  if (!canCreate) return null;

  return (
    <div className="card p-6">
      <ClienteForm
        mode="create"
        onSubmit={async (data) => {
          await createClient(data);
          router.push("/clientes?success=created");
        }}
      />
    </div>
  );
}
