import { redirect } from "next/navigation";

const INVENTARIO = "/vista-previa-suite/logistica/inventario";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

/** El hub «/logistica» redirige al submódulo de inventario (mantiene query p. ej. ?projectId=). */
export default function LogisticaHubPage({ searchParams }: PageProps) {
  const sp = new URLSearchParams();
  const raw = searchParams ?? {};
  for (const [key, val] of Object.entries(raw)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      for (const v of val) sp.append(key, v);
    } else {
      sp.set(key, val);
    }
  }
  const q = sp.toString();
  redirect(q ? `${INVENTARIO}?${q}` : INVENTARIO);
}
