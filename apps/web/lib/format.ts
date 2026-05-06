/**
 * Helpers de formato compartidos (fechas, moneda, porcentajes).
 * Locale: es-CL (Chile).
 */

export function formatDate(s: string | Date | null | undefined): string {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s) : s;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatMoney(
  n: number | undefined | null,
  currency = ""
): string {
  if (n == null || Number.isNaN(n)) return "—";
  const formatted = new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  return currency ? `${currency} ${formatted}` : formatted;
}

export function formatPercent(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n) + " %";
}

export function formatNumber(
  n: number | undefined | null,
  decimals = 0
): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}
