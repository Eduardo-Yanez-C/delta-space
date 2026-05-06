/** Fechas de planificación en pantalla: DD/MM/AAAA. */
export function formatIsoDateDDMMAAAA(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const [, y, mo, day] = m;
  return `${day}/${mo}/${y}`;
}
