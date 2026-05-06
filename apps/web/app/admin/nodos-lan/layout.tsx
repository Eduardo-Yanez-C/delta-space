"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCan } from "../../../lib/useCan";

export default function NodosLanLayout({ children }: { children: React.ReactNode }) {
  const canManage = useCan("manage", "lanNodes");
  const router = useRouter();

  useEffect(() => {
    if (!canManage) {
      router.replace("/acceso-restringido");
    }
  }, [canManage, router]);

  if (!canManage) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Redirigiendo…</p>
      </div>
    );
  }

  return <>{children}</>;
}
