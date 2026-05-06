"use client";

import { useRouter } from "next/navigation";
import { useCan } from "../../lib/useCan";
import { EstudiosFvList } from "./EstudiosFvList";

export default function EstudiosFvPage() {
  const canRead = useCan("read", "fvStudy");
  const router = useRouter();

  if (typeof window !== "undefined" && !canRead) {
    router.replace("/acceso-restringido");
    return null;
  }

  return (
    <div className="space-y-4">
      <EstudiosFvList />
    </div>
  );
}
