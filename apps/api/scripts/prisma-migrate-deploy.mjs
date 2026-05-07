/**
 * Wrapper de `prisma migrate deploy` para Supabase + Railway.
 *
 * El pooler en modo "Session" limita conexiones (~15); las migraciones Prisma deben usar
 * la URI **Direct** (host db.*.supabase.co:5432) vía DATABASE_DIRECT_URL.
 *
 * @see https://www.prisma.io/docs/guides/database/supabase-creating-a-project#configure-the-postgresql-connection-url
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

const databaseUrl = (process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("[prisma-migrate-deploy] Falta DATABASE_URL.");
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

if (looksLikeSupabasePooler(databaseUrl) && directUrl === databaseUrl) {
  console.error(
    "[prisma-migrate-deploy] DATABASE_URL apunta al pooler de Supabase; `migrate deploy` no puede usar solo esa URI.",
  );
  console.error(
    "  1) Supabase → Project Settings → Database → Connection string → elija modo/host **Direct** (db.PROJECT.supabase.co:5432).",
  );
  console.error("  2) Railway (servicio api) → Variables → DATABASE_DIRECT_URL = esa URI (con sslmode=require si aplica).");
  console.error(
    "  3) Deje DATABASE_URL con Session pooler para la app si lo desea, o use Transaction pooler según su plan.",
  );
  process.exit(1);
}

const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  cwd: apiRoot,
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(typeof r.status === "number" ? r.status : 1);
