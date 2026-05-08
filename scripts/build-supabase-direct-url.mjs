#!/usr/bin/env node
/**
 * Pide la contraseña de la base (Supabase) en terminal, construye DATABASE_DIRECT_URL
 * con la contraseña codificada para la URI, y la deja en portapapeles + archivo local (gitignored).
 *
 * Uso (desde la raíz del monorepo):
 *   npm run railway:db-direct-url
 *
 * Luego en Railway (servicio api): variable DATABASE_DIRECT_URL = pegar desde portapapeles o desde
 *   apps/api/.env.railway.generated
 *
 * DATABASE_URL (pooler Session) sigue teniendo que copiarse del panel de Supabase; no se adivina aquí.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const DEFAULT_REF = process.env.SUPABASE_PROJECT_REF || "cwbgwedntdnivssjtlfm";
const DIRECT_HOST = `db.${DEFAULT_REF}.supabase.co`;
const OUT_FILE = path.join(repoRoot, "apps", "api", ".env.railway.generated");

function readPasswordHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY) {
      reject(new Error("Se requiere una terminal interactiva (TTY)."));
      return;
    }
    stdout.write(prompt);
    let pass = "";
    let rawOk = true;
    try {
      stdin.setRawMode(true);
    } catch {
      rawOk = false;
    }
    if (!rawOk) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      rl.question("", (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (key) => {
      const s = key.toString("utf8");
      if (s === "\u0003") {
        stdin.setRawMode(false);
        process.exit(130);
      }
      if (s === "\r" || s === "\n" || s === "\u0004") {
        stdin.setRawMode(false);
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(pass);
        return;
      }
      if (s === "\u007f" || s === "\b") {
        pass = pass.slice(0, -1);
        return;
      }
      pass += s;
    };
    stdin.on("data", onData);
  });
}

function copyToClipboard(text) {
  if (process.platform === "win32") {
    const r = spawnSync("clip", {
      input: Buffer.from(text, "utf16le"),
      stdio: ["pipe", "inherit", "inherit"],
      shell: false,
    });
    return r.status === 0;
  }
  if (process.platform === "darwin") {
    const r = spawnSync("pbcopy", { input: text, encoding: "utf-8" });
    return r.status === 0;
  }
  for (const cmd of [
    ["wl-copy", []],
    ["xclip", ["-selection", "clipboard"]],
    ["xsel", ["--clipboard", "--input"]],
  ]) {
    const r = spawnSync(cmd[0], cmd[1], { input: text, encoding: "utf-8", shell: false });
    if (r.status === 0) return true;
  }
  return false;
}

async function main() {
  console.log(
    "\n  Supabase → conexión **Direct** (migraciones Prisma / DATABASE_DIRECT_URL)\n" +
      `  Host: ${DIRECT_HOST}\n` +
      (process.env.SUPABASE_PROJECT_REF
        ? ""
        : `  (Proyecto ref: ${DEFAULT_REF}. Otro ref: $env:SUPABASE_PROJECT_REF=\"...\" npm run railway:db-direct-url)\n`),
  );

  let password;
  try {
    password = await readPasswordHidden("  Contraseña de la base (no se muestra al escribir): ");
  } catch (e) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    password = await new Promise((resolve) => {
      rl.question("  Contraseña (visible en este terminal): ", (a) => {
        rl.close();
        resolve(a);
      });
    });
  }

  const pw = (password || "").trim();
  if (!pw) {
    console.error("  Contraseña vacía. Cancelado.");
    process.exit(1);
  }

  const enc = encodeURIComponent(pw);
  const directUrl = `postgresql://postgres:${enc}@${DIRECT_HOST}:5432/postgres?sslmode=require`;

  const fileBody =
    "# Generado por scripts/build-supabase-direct-url.mjs — NO commitear (gitignore .env.*)\n" +
    "# Railway → servicio api → Variable DATABASE_DIRECT_URL (valor en una sola línea, sin comillas en el panel)\n" +
    `DATABASE_DIRECT_URL=${directUrl}\n` +
    "\n" +
    "# Copie DATABASE_URL desde Supabase (Connection string → Session / pooler) y añádala en Railway como DATABASE_URL\n" +
    "# DATABASE_URL=postgresql://...\n";

  fs.writeFileSync(OUT_FILE, fileBody, "utf8");

  const clipOk = copyToClipboard(directUrl);
  console.log(`\n  Archivo: ${OUT_FILE}`);
  if (clipOk) {
    console.log("  Listo: la URL **directa** (solo el valor) quedó en el **portapapeles**.");
  } else {
    console.log("  No se pudo usar el portapapeles; abra el archivo de arriba y copie DATABASE_DIRECT_URL.");
  }
  console.log(
    "\n  En Railway → api → Variables:\n" +
      "    • DATABASE_DIRECT_URL  =  Ctrl+V (un solo valor, sin comillas extra)\n" +
      "    • DATABASE_URL         =  copie la cadena **Session pooler** desde Supabase (pestaña Database)\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
