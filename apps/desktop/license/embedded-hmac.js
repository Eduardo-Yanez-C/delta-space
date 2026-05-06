/**
 * Lee LICENSE_HMAC_SECRET desde la ruta absoluta de un archivo .env (misma convención que Nest/dotenv).
 * En portable: preferir `env.embedded` (siempre incluido en extraResources); `.env` a veces no se empaqueta.
 */
const fs = require("fs");
const path = require("path");

/**
 * Igual que dotenv/Nest: CR solo (\r) o CRLF deben partir líneas. Si no, una línea
 * `# comentario\rLICENSE_HMAC_SECRET=...` queda como una sola línea que empieza en `#`
 * y Electron nunca ve el secreto (Nest sí, porque dotenv parte en \r).
 */
function normalizeDotenvNewlines(raw) {
  return String(raw).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * @param {string} envPath
 * @returns {string | null}
 */
function readLicenseHmacFromDotenvFile(envPath) {
  if (!envPath || !fs.existsSync(envPath)) return null;
  let raw;
  try {
    raw = fs.readFileSync(envPath, "utf8");
  } catch {
    return null;
  }
  raw = normalizeDotenvNewlines(raw);
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  for (const line of raw.split("\n")) {
    if (!/^\s*LICENSE_HMAC_SECRET\s*=/i.test(line)) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    const v = val.trim();
    if (v) return v;
    break;
  }
  const m = raw.match(/^\s*LICENSE_HMAC_SECRET\s*=\s*("([^"]*)"|'([^']*)'|([^\r\n#]+))/im);
  if (m) {
    const v = (m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (v) return v;
  }
  return null;
}

/**
 * Intenta leer el HMAC desde el directorio `resources/backend` (o equivalente).
 * Orden: env.embedded → .env (misma prioridad conceptual que Nest: envFilePath).
 *
 * @param {string} backendDir
 * @returns {{ secret: string, pathUsed: string } | null }
 */
function readLicenseHmacFromBackendDir(backendDir) {
  if (!backendDir) return null;
  const names = ["env.embedded", ".env"];
  for (const name of names) {
    const full = path.join(backendDir, name);
    const s = readLicenseHmacFromDotenvFile(full);
    if (s) return { secret: s, pathUsed: full };
  }
  return null;
}

module.exports = {
  readLicenseHmacFromDotenvFile,
  readLicenseHmacFromBackendDir,
  normalizeDotenvNewlines,
};
