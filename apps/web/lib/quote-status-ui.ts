/**
 * Presentación consistente del estado comercial de cotizaciones (listados, badges).
 */
export function quoteCommercialStatusBadgeClass(status: string): string {
  const s = (status ?? "").trim();
  if (s === "BORRADOR") {
    return "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300";
  }
  if (s === "ACEPTADA") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (s === "ARCHIVADA") {
    return "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200";
  }
  if (s === "ANULADA") {
    return "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200";
  }
  if (s === "RECHAZADA" || s === "EXPIRADA" || s === "CERRADA_SIN_VENTA") {
    return "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200";
  }
  if (s === "LISTA_PARA_ENVIAR" || s === "ENVIADA") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
  }
  return "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200";
}
