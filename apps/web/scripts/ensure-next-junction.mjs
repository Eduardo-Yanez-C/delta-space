/**
 * Next.js siempre hace `path.join(dirProjecto, distDir)`; un `distDir` absoluto en Windows
 * puede concatenarse mal (ENOENT con ruta ...\web\C:\Users\...).
 *
 * En carpetas bajo OneDrive: `apps/web/.next` se crea como **junction** hacia %TEMP%\pv-quoting-next\<hash>
 * (NTFS real, sin readlink roto de OneDrive). Next sigue usando `distDir: ".next"` (relativo).
 *
 * No usamos `cmd /c mklink`: con rutas con espacios Node escapa mal y cmd devuelve
 * «la sintaxis de la etiqueta del volumen no es correcta».
 *
 * - NEXT_NO_ONEDRIVE_DIST=1 → no hacer nada.
 * - BUILD_DESKTOP=1 → no hacer nada (standalone espera `.next` real bajo apps/web).
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function isOneDrivePath(p) {
  return p.replace(/\\/g, "/").toLowerCase().includes("onedrive");
}

function shouldSkip() {
  if (process.env.NEXT_NO_ONEDRIVE_DIST === "1") return true;
  if (process.env.BUILD_DESKTOP === "1") return true;
  // En build de producción necesitamos que `.next` viva dentro del proyecto
  // (Next ejecuta código desde `.next/server` y debe poder resolver `react/*` subiendo a node_modules).
  const lifecycle = String(process.env.npm_lifecycle_event ?? "").toLowerCase();
  if (lifecycle === "build" || lifecycle === "prebuild") return true;
  if (process.platform !== "win32") return true;
  return !isOneDrivePath(webRoot);
}

/** Comilla simple para cadenas -LiteralPath / -Target en PowerShell. */
function escapePsSingle(s) {
  return String(s).replace(/'/g, "''");
}

/** Quita `.next` (junction sin borrar destino, o carpeta completa). */
function removeNextLinkOrDir(absLink) {
  if (!fs.existsSync(absLink)) return;
  if (process.platform !== "win32") {
    fs.rmSync(absLink, { recursive: true, force: true });
    return;
  }
  try {
    fs.unlinkSync(absLink);
    return;
  } catch {
    /* no es enlace / falló */
  }
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$p='${escapePsSingle(absLink)}'; if (Test-Path -LiteralPath $p) { $i = Get-Item -LiteralPath $p -Force; if ($null -ne $i.LinkType -and $i.LinkType -eq 'Junction') { Remove-Item -LiteralPath $p -Force } else { Remove-Item -LiteralPath $p -Recurse -Force } }`,
      ],
      { stdio: "pipe", windowsHide: true },
    );
  } catch {
    fs.rmSync(absLink, { recursive: true, force: true });
  }
}

function createJunction(absTarget, absLink) {
  try {
    fs.symlinkSync(absTarget, absLink, "junction");
    return;
  } catch (e1) {
    try {
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `New-Item -ItemType Junction -LiteralPath '${escapePsSingle(absLink)}' -Target '${escapePsSingle(absTarget)}' | Out-Null`,
        ],
        { stdio: "pipe", windowsHide: true },
      );
      return;
    } catch (e2) {
      const m1 = e1 instanceof Error ? e1.message : String(e1);
      const m2 = e2 instanceof Error ? e2.message : String(e2);
      throw new Error(`Node junction: ${m1}; PowerShell: ${m2}`);
    }
  }
}

function main() {
  if (shouldSkip()) {
    // Asegurar que `.next` sea local (no junction) en build.
    const absLink = path.resolve(webRoot, ".next");
    if (process.platform === "win32" && fs.existsSync(absLink)) {
      try {
        const out = execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `$p='${escapePsSingle(absLink)}'; if (Test-Path -LiteralPath $p) { $i = Get-Item -LiteralPath $p -Force; if ($null -ne $i.LinkType -and $i.LinkType -eq 'Junction') { 'junction' } else { 'other' } }`,
          ],
          { stdio: "pipe", windowsHide: true },
        )
          .toString()
          .trim()
          .toLowerCase();
        if (out === "junction") {
          const rp = (() => {
            try {
              return fs.realpathSync.native ? fs.realpathSync.native(absLink) : fs.realpathSync(absLink);
            } catch {
              return null;
            }
          })();
          removeNextLinkOrDir(absLink);
          fs.mkdirSync(absLink, { recursive: true });
          console.log(`[ensure-next-junction] build: .next local (se quitó junction${rp ? ` a ${rp}` : ""})`);
        }
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const hash = crypto.createHash("sha256").update(webRoot).digest("hex").slice(0, 14);
  const target = path.resolve(os.tmpdir(), "pv-quoting-next", hash);
  fs.mkdirSync(target, { recursive: true });

  const absLink = path.resolve(webRoot, ".next");
  const absTarget = path.resolve(target);

  removeNextLinkOrDir(absLink);

  try {
    createJunction(absTarget, absLink);
    console.log(`[ensure-next-junction] .next → ${absTarget}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ensure-next-junction] No se pudo crear el junction:", msg);
    console.error("  Opciones: activar Modo de desarrollador en Windows (enlaces), o mueva el repo fuera de OneDrive.");
    process.exit(1);
  }
}

main();
