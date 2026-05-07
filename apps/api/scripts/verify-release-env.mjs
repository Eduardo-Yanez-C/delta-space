/**
 * Verificación de entorno API antes de desplegar a nube.
 *
 * Uso:
 *   RELEASE_VERIFY_STRICT=1 NODE_ENV=production node scripts/verify-release-env.mjs
 * CI: definir JWT_SECRET, DATABASE_URL, WEB_ORIGIN o CORS_ORIGIN, y storage si aplica.
 *
 * Omitir: SKIP_RELEASE_ENV_CHECK=1
 */
const isTruthy = (v) => v === "1" || v === "true" || v === "yes";

function fail(msg) {
  console.error("[verify-release-env:api]", msg);
  process.exit(1);
}

if (isTruthy(process.env.SKIP_RELEASE_ENV_CHECK)) {
  console.log("[verify-release-env:api] Omitido (SKIP_RELEASE_ENV_CHECK).");
  process.exit(0);
}

const strict = isTruthy(process.env.RELEASE_VERIFY_STRICT);
const prodLike = process.env.NODE_ENV === "production" || isTruthy(process.env.CI);

if (!strict && !prodLike) {
  console.log("[verify-release-env:api] No estricto (use RELEASE_VERIFY_STRICT=1 o CI=1).");
  process.exit(0);
}

const db = process.env.DATABASE_URL?.trim() || "";
if (!db.startsWith("postgresql://") && !db.startsWith("postgres://")) {
  fail("DATABASE_URL debe ser postgresql:// o postgres:// para despliegue nube.");
}

const dbDirect = process.env.DATABASE_DIRECT_URL?.trim() || "";
const looksLikePooler = /pooler\.supabase\.com/i.test(db) || /[?&]pgbouncer=true/i.test(db);
if (strict && looksLikePooler && (!dbDirect || dbDirect === db)) {
  fail(
    "DATABASE_URL apunta al pooler de Supabase. Defina DATABASE_DIRECT_URL con la URI Direct (host db.*.supabase.co:5432) para migraciones y Prisma.",
  );
}
if (strict && !dbDirect) {
  fail("Defina DATABASE_DIRECT_URL (puede ser igual que DATABASE_URL si no usa pooler).");
}

const jwt = process.env.JWT_SECRET?.trim() || "";
if (jwt.length < 32) {
  fail("JWT_SECRET debe tener al menos 32 caracteres en entorno release.");
}
if (/placeholder|CAMBIAR|cambiar|CHANGE_ME/i.test(jwt)) {
  fail("JWT_SECRET parece un placeholder; use un secreto real en release.");
}

const origin =
  (process.env.WEB_ORIGIN && process.env.WEB_ORIGIN.trim()) ||
  (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim()) ||
  "";
if (!origin) {
  fail("Defina WEB_ORIGIN o CORS_ORIGIN (origen del front en producción, puede ser lista separada por comas).");
}

const storage = (process.env.STORAGE_DRIVER || "local").toLowerCase();
if (storage === "supabase") {
  const need = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"];
  for (const k of need) {
    if (!(process.env[k] && String(process.env[k]).trim())) {
      fail(`Con STORAGE_DRIVER=supabase se requiere ${k}.`);
    }
  }
}

console.log("[verify-release-env:api] OK.");
