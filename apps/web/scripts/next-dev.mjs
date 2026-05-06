/**
 * Arranque de Next desde `apps/web` en un monorepo npm (workspaces).
 * npm 9+ puede lanzar ENOWORKSPACES si algún subproceso ejecuta `npm` con lógica de workspaces;
 * forzamos NPM_CONFIG_WORKSPACES=false solo en el entorno del proceso Next y sus hijos.
 *
 * OneDrive: antes de arrancar, `ensure-next-junction.mjs` crea junction `.next` → %TEMP% (ver ese script).
 */
import { execFileSync, spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { nodePathEnvForTempNext } from "./onedrive-node-path.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, "..");
const monoRoot = resolve(webRoot, "../..");
const nextCli = join(monoRoot, "node_modules", "next", "dist", "bin", "next");

try {
  execFileSync(process.execPath, [join(scriptDir, "ensure-next-junction.mjs")], {
    stdio: "inherit",
    cwd: webRoot,
  });
} catch {
  process.exit(1);
}

const env = {
  ...process.env,
  ...nodePathEnvForTempNext(webRoot, monoRoot),
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
  /** Evita ENOWORKSPACES cuando Next u otras herramientas invocan `npm` desde la carpeta del workspace. */
  NPM_CONFIG_WORKSPACES: "false",
};

const child = spawn(process.execPath, [nextCli, "dev"], {
  stdio: "inherit",
  cwd: webRoot,
  env,
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
