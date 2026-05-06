/**
 * Fusiona claves desde apps/desktop/desktop-build.env sobre un archivo .env destino.
 * Formato: líneas KEY=valor o KEY="valor", # comentarios.
 */
const fs = require("fs");

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (k) out[k] = v;
  }
  return out;
}

function escapeForDoubleQuotedEnv(v) {
  return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * @param {string} dotenvPath
 * @param {Record<string, string>} secrets
 */
function mergeSecretsIntoDotenv(dotenvPath, secrets) {
  let raw = fs.readFileSync(dotenvPath, "utf8");
  for (const [k, v] of Object.entries(secrets)) {
    if (v == null || String(v).trim() === "") continue;
    const esc = escapeForDoubleQuotedEnv(v);
    const escapedKey = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^\\s*${escapedKey}\\s*=.*$`, "m");
    const line = `${k}="${esc}"`;
    if (re.test(raw)) {
      raw = raw.replace(re, line);
    } else {
      raw = raw.trimEnd() + `\n${line}\n`;
    }
  }
  fs.writeFileSync(dotenvPath, raw, "utf8");
}

/**
 * @param {string} dotenvPath
 * @returns {string | null} valor de LICENSE_HMAC_SECRET o null
 */
function readLicenseHmacFromDotenv(dotenvPath) {
  if (!fs.existsSync(dotenvPath)) return null;
  const raw = fs.readFileSync(dotenvPath, "utf8");
  const m = raw.match(/^\s*LICENSE_HMAC_SECRET\s*=\s*("([^"]*)"|'([^']*)'|([^\s#]+))/m);
  if (!m) return null;
  return (m[2] ?? m[3] ?? m[4] ?? "").trim() || null;
}

module.exports = {
  parseEnvFile,
  mergeSecretsIntoDotenv,
  readLicenseHmacFromDotenv,
};
