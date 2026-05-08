/**
 * Wrapper de `prisma migrate deploy` para Supabase + Railway.
 *
 * Ideal: `DATABASE_DIRECT_URL` = Postgres **directo** (db.*.supabase.co:5432).
 * Ojo: ese host suele ser **solo IPv6**. Plataformas solo-IPv4 (p. ej. muchos contenedores)
 * dan Prisma P1001; Supabase recomienda **Supavisor modo Session** (pooler.*:5432, IPv4).
 * En ese caso pon `DATABASE_DIRECT_URL` = misma URI que **Session pooler** que `DATABASE_URL`.
 *
 * Modo **Transaction** (6543) con `pgbouncer=true` es válido si Session agota conexiones;
 * puede usar la **misma** URL en `DATABASE_URL` y `DATABASE_DIRECT_URL`.
 *
 * @see https://supabase.com/docs/guides/database/connecting-to-postgres
 * @see https://www.prisma.io/docs/guides/database/supabase-creating-a-project#configure-the-postgresql-connection-url
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

function isObviousNonProductionDbUrl(url) {
  if (!url) return false;
  try {
    const normalized = url.replace(/^postgres:\/\//i, "http://").replace(/^postgresql:\/\//i, "http://");
    const u = new URL(normalized);
    const db = (u.pathname || "").replace(/^\//, "").split("?")[0] || "";
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
      if (/placeholder/i.test(db) || u.username === "placeholder") return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

const databaseUrl = (process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("[prisma-migrate-deploy] Falta DATABASE_URL.");
  console.error(
    "  Railway → servicio **api** → Variables: defina DATABASE_URL (y DATABASE_DIRECT_URL si usa pooler Supabase).",
  );
  console.error(
    "  Si la imagen anterior llevaba URL de ejemplo, redeploy tras definir variables; la imagen nueva no embebe DATABASE_URL.",
  );
  process.exit(1);
}
if (isObviousNonProductionDbUrl(databaseUrl)) {
  console.error(
    "[prisma-migrate-deploy] DATABASE_URL parece la URL ficticia del build (127.0.0.1 / placeholder), no la base real.",
  );
  console.error(
    "  En Railway, abra el servicio **api** → Variables y añada DATABASE_URL (Postgres/Supabase). Guarde y vuelva a desplegar.",
  );
  console.error(
    "  Con pooler de Supabase en DATABASE_URL, añada también DATABASE_DIRECT_URL (host db.*.supabase.co, puerto 5432).",
  );
  process.exit(1);
}

let directUrl = (process.env.DATABASE_DIRECT_URL || "").trim();
if (!directUrl) {
  directUrl = databaseUrl;
  process.env.DATABASE_DIRECT_URL = directUrl;
}

function looksLikeSupabasePooler(url) {
  try {
    const normalized = url.replace(/^postgres:\/\//i, "http://").replace(/^postgresql:\/\//i, "http://");
    const u = new URL(normalized);
    if (/pooler\.supabase\.com$/i.test(u.hostname)) return true;
    return /[?&]pgbouncer=true/i.test(url);
  } catch {
    return false;
  }
}

/** Pooler Supavisor modo Session: IPv4 + puerto 5432 (recomendado si Direct da P1001 desde Railway). */
function looksLikeSupabaseSessionPooler(url) {
  try {
    const normalized = url.replace(/^postgres:\/\//i, "http://").replace(/^postgresql:\/\//i, "http://");
    const u = new URL(normalized);
    if (!/pooler\.supabase\.com$/i.test(u.hostname)) return false;
    const port = u.port || "5432";
    return port === "5432";
  } catch {
    return false;
  }
}

/** Modo Transaction (6543). Útil si Session pooler está saturado. */
function looksLikeSupabaseTransactionPooler(url) {
  try {
    const normalized = url.replace(/^postgres:\/\//i, "http://").replace(/^postgresql:\/\//i, "http://");
    const u = new URL(normalized);
    return (u.port || "") === "6543";
  } catch {
    return false;
  }
}

function hasQueryParam(raw, key) {
  try {
    const normalized = raw.replace(/^postgres:\/\//i, "http://").replace(/^postgresql:\/\//i, "http://");
    const u = new URL(normalized);
    return u.searchParams.has(key);
  } catch {
    return false;
  }
}

if (looksLikeSupabaseTransactionPooler(directUrl)) {
  if (!hasQueryParam(directUrl, "pgbouncer")) {
    console.error(
      "[prisma-migrate-deploy] DATABASE_DIRECT_URL apunta a pooler Transaction (6543) pero falta `pgbouncer=true`.",
    );
    console.error(
      "  Para Prisma en poolers: agregue `?pgbouncer=true` (o `&pgbouncer=true`) para desactivar prepared statements.",
    );
    process.exit(1);
  }
  console.log(
    "[prisma-migrate-deploy] Usando Transaction pooler (6543) para migraciones (pgbouncer=true).",
  );
}

if (looksLikeSupabasePooler(databaseUrl) && directUrl === databaseUrl) {
  if (looksLikeSupabaseSessionPooler(databaseUrl)) {
    console.log(
      "[prisma-migrate-deploy] Session pooler (IPv4) para URL y migraciones — adecuado si Direct (IPv6) falla con P1001 en Railway.",
    );
  } else if (
    looksLikeSupabaseTransactionPooler(databaseUrl) &&
    hasQueryParam(databaseUrl, "pgbouncer")
  ) {
    console.log(
      "[prisma-migrate-deploy] Transaction pooler (6543) con pgbouncer=true para URL y migraciones — evita límite de sesión (pool_size) en 5432.",
    );
  } else {
    console.error(
      "[prisma-migrate-deploy] DATABASE_URL es pooler Supabase pero no es Session (5432) ni Transaction (6543) con pgbouncer=true.",
    );
    console.error(
      "  • Session: misma cadena en DATABASE_URL y DATABASE_DIRECT_URL (host …pooler.supabase.com:5432).",
    );
    console.error(
      "  • Transaction: …:6543 con `pgbouncer=true` en la misma cadena para ambas variables si coinciden.",
    );
    console.error(
      "  • Direct IPv6: solo en DATABASE_DIRECT_URL si su red soporta IPv6.",
    );
    process.exit(1);
  }
}

/**
 * Prisma P1013 «invalid port» suele venir de URLs mal formadas: contraseña con @ # : / ? sin %XX.
 * Validamos antes de llamar a prisma para dar un mensaje útil.
 */
function validatePostgresUri(label, raw) {
  const s = raw.trim();
  if (!/^postgres(ql)?:\/\//i.test(s)) {
    console.error(`[prisma-migrate-deploy] ${label} debe empezar por postgresql:// o postgres://`);
    process.exit(1);
  }
  const normalized = s.replace(/^postgres:\/\//i, "http://").replace(/^postgresql:\/\//i, "http://");
  let u;
  try {
    u = new URL(normalized);
  } catch (e) {
    console.error(`[prisma-migrate-deploy] ${label} no es una URL válida (${e instanceof Error ? e.message : e}).`);
    console.error(
      "  Revise comillas, espacios al inicio/fin y que la contraseña use codificación URL si tiene @ # : / ?",
    );
    process.exit(1);
  }
  if (u.port && !/^\d{1,5}$/.test(u.port)) {
    console.error(
      `[prisma-migrate-deploy] ${label}: el parser interpretó el puerto como "${u.port}" (inválido).`,
    );
    console.error(
      "  Causa habitual: la contraseña de Postgres contiene @ u otros caracteres especiales sin codificar.",
    );
    console.error(
      "  Solución: en Supabase use «Copy» en la connection string completa, o codifique la contraseña (ej. @ → %40).",
    );
    console.error("  Ver: https://www.prisma.io/docs/orm/reference/connection-urls#special-characters");
    process.exit(1);
  }
  if (u.port && (Number(u.port) < 1 || Number(u.port) > 65535)) {
    console.error(`[prisma-migrate-deploy] ${label}: puerto fuera de rango (${u.port}).`);
    process.exit(1);
  }
}

validatePostgresUri("DATABASE_URL", databaseUrl);
validatePostgresUri("DATABASE_DIRECT_URL", directUrl);

const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  cwd: apiRoot,
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(typeof r.status === "number" ? r.status : 1);
