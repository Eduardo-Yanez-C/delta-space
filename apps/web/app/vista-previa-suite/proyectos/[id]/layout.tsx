"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

type TabKey =
  | "resumen"
  | "planning"
  | "carga"
  | "documentos"
  | "riesgos"
  | "recursos"
  | "ia-pmo"
  | "hitos"
  | "decisiones"
  | "compromisos";

function tabFromPath(pathname: string, prefix: string): TabKey {
  if (pathname.includes(`${prefix}/planning`)) return "planning";
  if (pathname.includes(`${prefix}/modulo/carga`)) return "carga";
  if (pathname.includes(`${prefix}/modulo/documentos`)) return "documentos";
  if (pathname.includes(`${prefix}/modulo/riesgos`)) return "riesgos";
  if (pathname.includes(`${prefix}/modulo/recursos`)) return "recursos";
  if (pathname.includes(`${prefix}/modulo/ia-pmo`)) return "ia-pmo";
  if (pathname.includes(`${prefix}/modulo/hitos`)) return "hitos";
  if (pathname.includes(`${prefix}/modulo/decisiones`)) return "decisiones";
  if (pathname.includes(`${prefix}/modulo/compromisos`)) return "compromisos";
  return "resumen";
}

export default function SuiteProyectoIdLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const id = String(params.id ?? "");
  const base = `/vista-previa-suite/proyectos/${id}`;
  const active = tabFromPath(pathname, base);

  const tabClass = (key: TabKey) =>
    `shrink-0 rounded-t-md border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
      active === key
        ? "border-slate-200 border-b-white bg-white text-slate-900 dark:border-neutral-600 dark:border-b-transparent dark:bg-white/[0.12] dark:text-white dark:shadow-[inset_0_-2px_0_0_rgba(91,140,255,0.85)]"
        : "border-transparent text-slate-600 hover:bg-slate-100/80 dark:text-neutral-400 dark:hover:bg-white/[0.06]"
    }`;

  const tabs: Array<{ key: TabKey; href: string; label: string }> = [
    { key: "resumen", href: base, label: "Resumen" },
    { key: "planning", href: `${base}/planning`, label: "Planificación" },
    { key: "carga", href: `${base}/modulo/carga`, label: "Carga" },
    { key: "documentos", href: `${base}/modulo/documentos`, label: "Documentos" },
    { key: "riesgos", href: `${base}/modulo/riesgos`, label: "Riesgos" },
    { key: "recursos", href: `${base}/modulo/recursos`, label: "Recursos" },
    { key: "ia-pmo", href: `${base}/modulo/ia-pmo`, label: "IA" },
    { key: "hitos", href: `${base}/modulo/hitos`, label: "Hitos" },
    { key: "decisiones", href: `${base}/modulo/decisiones`, label: "Decisiones" },
    { key: "compromisos", href: `${base}/modulo/compromisos`, label: "Compromisos" },
  ];

  return (
    <div className="min-h-0 dark:bg-[var(--suite-page-bg)]">
      <div className="sticky top-16 z-[25] border-b border-slate-200 bg-slate-50/95 px-3 pt-3 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-neutral-800 dark:bg-black/75 dark:shadow-[0_8px_32px_-6px_rgba(0,0,0,0.55)] md:px-6">
        <nav className="-mx-1 flex gap-0.5 overflow-x-auto pb-px" aria-label="Secciones del proyecto">
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} className={tabClass(t.key)}>
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="px-0 pb-6 pt-1">{children}</div>
    </div>
  );
}
