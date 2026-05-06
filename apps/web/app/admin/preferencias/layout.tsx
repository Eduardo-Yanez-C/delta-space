"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PreferenciasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOrt = pathname.includes("/ortografia");
  const isCol = pathname.includes("/colores");

  const tabCls = (active: boolean) =>
    `inline-flex items-center rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "border-primary-500 text-slate-900 dark:text-white"
        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
    }`;

  return (
    <div>
      <header className="mb-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Preferencias</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Escritura, corrección y apariencia. Más opciones se pueden agregar aquí con el tiempo.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Secciones de preferencias"
        className="mb-8 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700"
      >
        <Link role="tab" aria-selected={isOrt} href="/admin/preferencias/ortografia" className={tabCls(isOrt)}>
          Ortografía y escritura
        </Link>
        <Link role="tab" aria-selected={isCol} href="/admin/preferencias/colores" className={tabCls(isCol)}>
          Colores
        </Link>
      </div>

      {children}
    </div>
  );
}
