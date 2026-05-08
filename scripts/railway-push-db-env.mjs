#!/usr/bin/env node
/**
 * Sube DATABASE_URL y DATABASE_DIRECT_URL al servicio Railway (CLI), sin pegar secretos en el historial del shell.
 *
 * Requisitos:
 *   - `npx @railway/cli whoami` OK (una vez: `railway login` o variable de entorno RAILWAY_TOKEN).
 *   - En la raíz del repo (o carpeta enlazada): `railway link` si aún no hay `.railway/`.
 *
 * Uso (PowerShell), con archivo que NO esté en git (ej. apps/api/.env.railway):
 *   node scripts/railway-push-db-env.mjs --env-file apps/api/.env.railway --service api
 *
 * O exportando variables (copiadas desde Supabase → Database → Connection string):
 *   $env:DATABASE_URL="postgresql://..."
 *   $env:DATABASE_DIRECT_URL="postgresql://...@db.xxx.supabase.co:5432/..."
 *   node scripts/railway-push-db-env.mjs --service api
 *
 * Por defecto rechaza URLs a localhost salvo --allow-local (evita subir tu .env de desarrollo por error).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { service: "api", envFile: null, allowLocal: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--allow-local") out.allowLocal = true;
    else if (a === "--service" && argv[i + 1]) out.service = argv[++i];
    else if (a === "--env-file" && argv[i + 1]) out.envFile = path.resolve(repoRoot, argv[++i]);
    else {
      console.error("Argumento desconocido:", a);
      out.help = true;
    }
  }
  return out;
}

function parseEnvFileLines(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const map = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function looksLocalPostgres(url) {
  try {
    const n = url.replace(/^postgres:\/\//i, "http://").replace(/^postgresql:\/\//i, "http://");
    const u = new URL(n);
    return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]";
  } catch {
    return false;
  }
}

function looksLikeSupabasePooler(url) {
  try {
    const n = url.replace(/^postgres:\/\//i, "http://").replace(/^postgresql:\/\//i, "http://");
    const u = new URL(n);
    if (/pooler\.supabase\.com$/i.test(u.hostname)) return true;
    return /[?&]pgbouncer=true/i.test(url);
  } catch {
    return false;
  }
}

function railway(args, opts = {}) {
  return spawnSync("npx", ["--yes", "@railway/cli", ...args], {
    cwd: repoRoot,
    encoding: "utf-8",
    shell: true,
    stdio: opts.stdio ?? "inherit",
    input: opts.input,
  });
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Uso: node scripts/railway-push-db-env.mjs [--service api] [--env-file ruta] [--allow-local]

Copia las cadenas **Session pooler** y **Direct** desde Supabase (Project Settings → Database) a un archivo
gitignored (p. ej. apps/api/.env.railway) o defínalas en el entorno antes de ejecutar este script.
`);
    process.exit(args.help && process.argv.length > 2 ? 1 : 0);
  }

  const who = railway(["whoami"], { stdio: ["pipe", "pipe", "pipe"] });
  if (who.status !== 0) {
    console.error(who.stderr || who.stdout || "");
    console.error(
      "\nNo hay sesión Railway. Opciones:\n" +
        "  • Terminal interactiva: npx @railway/cli login\n" +
        "  • CI / Cursor sin navegador: defina RAILWAY_API_TOKEN o RAILWAY_TOKEN (ver docs.railway.com → Account tokens).",
    );
    process.exit(1);
  }

  const linked = fs.existsSync(path.join(repoRoot, ".railway"));
  if (!linked) {
    console.error(
      "No se encontró .railway/ en la raíz del repo. Enlace el proyecto:\n" +
        "  cd \"" +
        repoRoot +
        '"\n' +
        "  npx @railway/cli link",
    );
    process.exit(1);
  }

  let databaseUrl = (process.env.DATABASE_URL || "").trim();
  let directUrl = (process.env.DATABASE_DIRECT_URL || "").trim();

  if (args.envFile) {
    if (!fs.existsSync(args.envFile)) {
      console.error("No existe el archivo:", args.envFile);
      process.exit(1);
    }
    const m = parseEnvFileLines(args.envFile);
    databaseUrl = (m.get("DATABASE_URL") || databaseUrl).trim();
    directUrl = (m.get("DATABASE_DIRECT_URL") || directUrl).trim();
  }

  if (!databaseUrl) {
    console.error("Falta DATABASE_URL (variable de entorno o --env-file).");
    process.exit(1);
  }

  if (!args.allowLocal && looksLocalPostgres(databaseUrl)) {
    console.error(
      "DATABASE_URL apunta a localhost (probablemente desarrollo local). No se sube a Railway por seguridad.\n" +
        "Use un archivo con las URLs de Supabase/producción o pase --allow-local si realmente desea esto.",
    );
    process.exit(1);
  }

  if (looksLikeSupabasePooler(databaseUrl) && !directUrl) {
    console.error(
      "DATABASE_URL parece el pooler de Supabase. Defina también DATABASE_DIRECT_URL (URI Direct, host db.*.supabase.co).",
    );
    process.exit(1);
  }

  const skip = ["--skip-deploys", "--json"];

  const r1 = railway(
    ["variable", "set", "DATABASE_URL", "--stdin", "--service", args.service, ...skip],
    { stdio: ["pipe", "pipe", "inherit"], input: databaseUrl },
  );
  if (r1.status !== 0) {
    console.error(r1.stderr || "");
    process.exit(typeof r1.status === "number" ? r1.status : 1);
  }

  if (directUrl) {
    const r2 = railway(
      ["variable", "set", "DATABASE_DIRECT_URL", "--stdin", "--service", args.service, ...skip],
      { stdio: ["pipe", "pipe", "inherit"], input: directUrl },
    );
    if (r2.status !== 0) {
      console.error(r2.stderr || "");
      process.exit(typeof r2.status === "number" ? r2.status : 1);
    }
  }

  console.log(
    "\nVariables actualizadas en Railway (--skip-deploys). Lanzar despliegue:\n" +
      "  npx @railway/cli redeploy --service " +
      args.service +
      " --yes",
  );
}

main();
