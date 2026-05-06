/** Agrupa dígitos del cuerpo del RUT con puntos (grupos de 3 desde la izquierda, primer grupo 1–3 dígitos). */
function dotRutBody(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 8);
  if (!d) return "";
  const len = d.length;
  const mod = len % 3 || 3;
  let i = 0;
  let out = "";
  let first = true;
  while (i < len) {
    const take = first ? mod : 3;
    out += (out ? "." : "") + d.slice(i, i + take);
    i += take;
    first = false;
  }
  return out;
}

/**
 * Formatea el RUT chileno al escribir: cuerpo (hasta 8 dígitos) con puntos y dígito verificador (0–9 o K) tras guión.
 * Ejemplo: 101110001 + dígito → 10.111.000-1
 */
export function formatChileRutInput(raw: string): string {
  const upper = raw.toUpperCase();
  let canon = "";
  for (let i = 0; i < upper.length; i++) {
    const c = upper[i]!;
    if (/\d/.test(c)) canon += c;
    else if (c === "K" && i === upper.length - 1) canon += "K";
  }
  if (!canon) return "";

  let bodyDigits = "";
  let dv = "";

  if (canon.endsWith("K")) {
    bodyDigits = canon.slice(0, -1).replace(/\D/g, "").slice(0, 8);
    dv = "K";
  } else if (canon.length > 8) {
    bodyDigits = canon.slice(0, -1).replace(/\D/g, "").slice(0, 8);
    const last = canon.slice(-1);
    dv = /\d/.test(last) ? last : "";
  } else {
    bodyDigits = canon.replace(/\D/g, "").slice(0, 8);
  }

  const dotted = dotRutBody(bodyDigits);
  if (dv) return `${dotted}-${dv}`;
  return dotted;
}
