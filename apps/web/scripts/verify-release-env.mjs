/**
 * Verificación mínima de variables para build web orientado a nube (Vercel, etc.).
 * Se ejecuta en `prebuild` de Next (NODE_ENV=production durante `next build`).
 *
 * Omitir: BUILD_DESKTOP=1 | SKIP_RELEASE_ENV_CHECK=1
 */
const isTruthy = (v) => v === "1" || v === "true" || v === "yes";

function fail(msg) {
  console.error("[verify-release-env:web]", msg);
  process.exit(1);
}

if (isTruthy(process.env.BUILD_DESKTOP) || isTruthy(process.env.SKIP_RELEASE_ENV_CHECK)) {
  console.log("[verify-release-env:web] Omitido (BUILD_DESKTOP o SKIP_RELEASE_ENV_CHECK).");
  process.exit(0);
}

if (process.env.NODE_ENV !== "production") {
  console.log("[verify-release-env:web] NODE_ENV !== production; omitido en dev.");
  process.exit(0);
}

const base =
  (process.env.NEXT_PUBLIC_API_BASE_URL && process.env.NEXT_PUBLIC_API_BASE_URL.trim()) ||
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) ||
  "";

if (!base) {
  fail(
    "En build de producción debe definirse NEXT_PUBLIC_API_BASE_URL (preferido) o NEXT_PUBLIC_API_URL con la URL absoluta del API (ej. https://api.tudominio.com/api).",
  );
}

try {
  const u = new URL(base);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    fail(`La URL del API debe ser http(s): ${base}`);
  }
} catch {
  fail(`NEXT_PUBLIC_API_* no es una URL válida: ${base}`);
}

console.log("[verify-release-env:web] OK — API pública configurada.");
