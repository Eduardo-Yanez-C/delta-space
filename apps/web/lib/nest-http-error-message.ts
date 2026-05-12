/**
 * Interpreta el cuerpo de una respuesta `fetch` ya leída como texto (un solo `res.text()`).
 * Si no es JSON (p. ej. HTML de Next en 500), devuelve un objeto con `message` explicable.
 */
export function parseFetchBodyAsNestJson(text: string, httpStatus: number): unknown {
  const t = text.trim();
  if (!t) return {};
  try {
    return JSON.parse(t) as unknown;
  } catch {
    if (/<!DOCTYPE/i.test(t) || /<html/i.test(t)) {
      return {
        message: `El servidor respondió con página HTML (HTTP ${httpStatus}), no con JSON del API Nest. Compruebe que el backend esté en ejecución (p. ej. puerto 4000) y que la URL del API apunte a Nest (p. ej. http://localhost:4000/api), no solo a la web Next.`,
      };
    }
    return { message: t.slice(0, 500) || `HTTP ${httpStatus}` };
  }
}

/**
 * Unifica el texto de error de respuestas HTTP de Nest (ConflictException, ValidationPipe, etc.).
 * `message` suele ser string o string[] en 400/422.
 */
export function nestHttpErrorMessage(body: unknown, fallback: string): string {
  if (body == null || typeof body !== "object") return fallback;
  const o = body as Record<string, unknown>;
  const m = o.message;
  if (typeof m === "string" && m.trim() !== "") return m.trim();
  if (Array.isArray(m) && m.length > 0) {
    const parts = m
      .map((x) => (typeof x === "string" ? x.trim() : String(x)))
      .filter((s) => s.length > 0);
    if (parts.length > 0) return parts.join("; ");
  }
  return fallback;
}
