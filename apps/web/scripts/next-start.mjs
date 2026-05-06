/**
 * Igual que en dev: con junction `.next` → %TEMP%, hace falta `NODE_PATH` para resolver react, etc.
 */
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { nodePathEnvForTempNext } from "./onedrive-node-path.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDir, "..");
const monoRoot = resolve(webRoot, "../..");
const nextCli = join(monoRoot, "node_modules", "next", "dist", "bin", "next");

const env = {
  ...process.env,
  ...nodePathEnvForTempNext(webRoot, monoRoot),
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1",
  NPM_CONFIG_WORKSPACES: process.env.NPM_CONFIG_WORKSPACES ?? "false",
};

const child = spawn(process.execPath, [nextCli, "start"], {
  stdio: "inherit",
  cwd: webRoot,
  env,
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
