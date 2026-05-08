/**
 * Arranque producción (Railway/Docker): migraciones con tope de tiempo y luego Nest.
 *
 * Si `prisma migrate deploy` se cuelga (red/Supabase/pooler), el arranque en shell anterior
 * no llegaba a `node dist/main.js` y el healthcheck de Railway fallaba minutos enteros.
 *
 * Variable opcional: PRISMA_DEPLOY_TIMEOUT_MS (default 120000, máximo 600000).
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

const timeoutMs = Math.max(
  10_000,
  Math.min(Number(process.env.PRISMA_DEPLOY_TIMEOUT_MS) || 120_000, 600_000),
);

function runMigrateWithTimeout() {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (reason) => {
      if (settled) return;
      settled = true;
      resolve(reason);
    };

    const child = spawn(process.execPath, ["scripts/prisma-migrate-deploy.mjs"], {
      cwd: apiRoot,
      stdio: "inherit",
      env: process.env,
    });

    const timer = setTimeout(() => {
      console.error(
        `[start-api-prod] prisma migrate deploy superó ${timeoutMs} ms — enviando SIGTERM (PRISMA_DEPLOY_TIMEOUT_MS).`,
      );
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) {
          child.kill("SIGKILL");
          settle("timeout");
        }
      }, 8000);
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      console.error("[start-api-prod] error al ejecutar migraciones:", err);
      settle("error");
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      if (code === 0) settle("ok");
      else if (signal === "SIGTERM" || signal === "SIGKILL") settle("timeout");
      else {
        console.error(
          `[start-api-prod] prisma migrate deploy salió con código ${code}; se inicia el API igual.`,
        );
        settle("fail");
      }
    });
  });
}

await runMigrateWithTimeout();

const r = spawnSync(process.execPath, ["dist/main.js"], {
  cwd: apiRoot,
  stdio: "inherit",
  env: process.env,
});

process.exit(typeof r.status === "number" ? r.status : 1);
