import Link from "next/link";

/** Placeholder: panel global del sistema (sin widgets ni datos por ahora). */
export default function PanelGeneralPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suite</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Panel general</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Vista reservada para un panel global del producto. Aún no hay widgets ni datos en esta pantalla.
      </p>
      <Link href="/" className="mt-10 inline-block text-sm font-medium text-primary-600 underline hover:no-underline">
        Volver (Inicio → panel de ventas)
      </Link>
    </div>
  );
}
