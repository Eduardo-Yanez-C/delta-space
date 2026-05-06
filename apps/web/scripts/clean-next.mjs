/**
 * Borra `.next` (carpeta o junction). Evita `cmd /c rmdir "…"` con espacios en la ruta.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = path.resolve(webRoot, ".next");

function escapePsSingle(s) {
  return String(s).replace(/'/g, "''");
}

try {
  if (fs.existsSync(nextDir)) {
    if (process.platform === "win32") {
      try {
        fs.unlinkSync(nextDir);
      } catch {
        try {
          execFileSync(
            "powershell.exe",
            [
              "-NoProfile",
              "-NonInteractive",
              "-Command",
              `$p='${escapePsSingle(nextDir)}'; if (Test-Path -LiteralPath $p) { $i = Get-Item -LiteralPath $p -Force; if ($null -ne $i.LinkType -and $i.LinkType -eq 'Junction') { Remove-Item -LiteralPath $p -Force } else { Remove-Item -LiteralPath $p -Recurse -Force } }`,
            ],
            { stdio: "pipe", windowsHide: true },
          );
        } catch {
          fs.rmSync(nextDir, { recursive: true, force: true });
        }
      }
    } else {
      fs.rmSync(nextDir, { recursive: true, force: true });
    }
  }
  console.log("[clean-next] Eliminado:", nextDir);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.warn("[clean-next] No se pudo borrar .next:", msg);
}
