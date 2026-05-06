"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCan } from "../../lib/useCan";

export default function InstalacionesLayout({ children }: { children: React.ReactNode }) {
  const canAccess = useCan("access", "installations");
  const router = useRouter();

  useEffect(() => {
    if (!canAccess) {
      router.replace("/acceso-restringido");
    }
  }, [canAccess, router]);

  if (!canAccess) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Redirigiendo…</p>
      </div>
    );
  }

  return <>{children}</>;
}
