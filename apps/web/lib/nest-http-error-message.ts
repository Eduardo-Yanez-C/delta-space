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
