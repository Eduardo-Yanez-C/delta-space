/**
 * Entrada formateada estilo Chile: miles con punto, RUT con puntos y guion.
 */

/** Solo dígitos del cuerpo + dígito verificador (0-9 o K). */
export function rutDigitsOnly(raw: string): string {
  return raw.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Calcula DV chileno para cuerpo numérico (sin DV). */
export function rutComputeDv(body: string): string {
  const clean = body.replace(/\D/g, "");
  if (!clean) return "";
  let sum = 0;
  let mult = 2;
  for (let i = clean.length - 1; i >= 0; i--) {
    sum += parseInt(clean[i]!, 10) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const r = 11 - (sum % 11);
  if (r === 11) return "0";
  if (r === 10) return "K";
  return String(r);
}

/** True si el RUT completo (cuerpo+DV) es válido. Vacío → true (opcional en formularios). */
export function rutIsValid(full: string): boolean {
  const s = rutDigitsOnly(full);
  if (s.length === 0) return true;
  if (s.length < 2) return false;
  const body = s.slice(0, -1);
  const dv = s.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  return rutComputeDv(body) === dv;
}

/** Formato visual 12.345.678-9 mientras se escribe. */
export function formatRutInput(raw: string): string {
  const s = rutDigitsOnly(raw);
  if (!s) return "";
  const body = s.slice(0, -1);
  const dv = s.slice(-1);
  if (!body) return dv;
  const dotted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${dotted}-${dv}`;
}

/** Valor a persistir: sin puntos ni guion, con DV al final (ej. 182870331). */
export function rutToStorageString(formatted: string): string {
  return rutDigitsOnly(formatted);
}

/** RUT ya guardado (solo dígitos + DV) → formato chileno para tablas, PDF y detalle. */
export function formatRutForDisplay(raw: string | null | undefined): string {
  if (raw == null) return "";
  const t = String(raw).trim();
  if (!t) return "";
  return formatRutInput(t);
}

/** Miles con punto (solo parte entera). */
export function formatIntegerThousandsFromDigits(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (!d) return "";
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Normaliza texto de precio/monto: miles con . y opcional decimal con coma o punto. */
export function parseLocaleMoneyNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "");
  if (!t) return null;

  if (t.includes(",")) {
    const idx = t.lastIndexOf(",");
    const intRaw = t.slice(0, idx);
    const decRaw = t.slice(idx + 1).replace(/[^\d]/g, "");
    const intPart = intRaw.replace(/\./g, "").replace(/[^\d]/g, "");
    if (!intPart && !decRaw) return null;
    const n = decRaw.length ? Number(`${intPart || "0"}.${decRaw}`) : Number(intPart);
    return Number.isFinite(n) ? n : null;
  }

  const dotCount = (t.match(/\./g) ?? []).length;
  if (dotCount === 0) {
    const n = Number(t.replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  const lastDot = t.lastIndexOf(".");
  const after = t.slice(lastDot + 1);
  if (/^\d{1,2}$/.test(after) && dotCount === 1) {
    const intPart = t.slice(0, lastDot).replace(/[^\d]/g, "");
    const n = Number(`${intPart}.${after}`);
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(t.replace(/\./g, "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Borrador visual al abrir edición inline de montos. */
export function formatMoneyDraft(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.trunc(rounded)) < 1e-9) {
    return formatIntegerThousandsFromDigits(String(Math.trunc(rounded)));
  }
  const [a, b] = rounded.toFixed(2).split(".");
  const intFmt = formatIntegerThousandsFromDigits(a);
  return `${intFmt},${b}`;
}

/** onChange para campo solo entero con miles (CLP típico). */
export function onMoneyIntegerInputChange(raw: string): string {
  return formatIntegerThousandsFromDigits(raw);
}
