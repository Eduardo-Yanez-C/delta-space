/**
 * Normaliza `suiteNavGrants` guardados por usuario.
 * Las claves siguen el mismo esquema que `apps/web/lib/suite-nav-registry.ts` (p. ej. `panel_general`, `ventas.clientes`).
 * Se valida con patrón seguro para que nuevas entradas del menú en el front no requieran actualizar esta lista.
 */

const SUITE_GRANT_KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const MAX_KEY_LEN = 96;

export function normalizeSuiteNavGrantsInput(input: unknown): string[] | null {
  if (input === null) return null;
  if (!Array.isArray(input)) return null;
  const out = new Set<string>();
  for (const x of input) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (t.length === 0 || t.length > MAX_KEY_LEN) continue;
    if (!SUITE_GRANT_KEY_RE.test(t)) continue;
    out.add(t);
  }
  return [...out];
}

export function parseStoredSuiteNavGrants(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return normalizeSuiteNavGrantsInput(raw);
  }
  return null;
}
