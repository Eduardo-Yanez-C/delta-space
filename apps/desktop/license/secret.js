/**
 * Secreto HMAC para licencias del escritorio.
 *
 * EMPAQUETADO: se lee desde resources/backend/env.embedded o .env (Nest carga ambos vía ConfigModule).
 * No se usa process.env para el HMAC en producción — evita desalineación con variables de Windows.
 * Si no hay secreto legible en disco: Error explícito (no hay fallback placeholder en portable).
 *
 * DESARROLLO (no empaquetado): LICENSE_HMAC_SECRET en process.env o fallback de desarrollo.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { readLicenseHmacFromBackendDir } = require("./embedded-hmac");

function looksLikePlaceholderSecret(secret) {
  const s = String(secret);
  return (
    /PVQ-DESKTOP-LICENSE-CHANGE-ME-IN-CI$/i.test(s) ||
    /MISMO_SECRETO_QUE_BUILD|CHANGE-ME-IN-CI|PVQ-DESKTOP-LICENSE-CHANGE-ME/i.test(s)
  );
}

function isPackagedElectron() {
  try {
    const { app } = require("electron");
    return !!(app && app.isPackaged);
  } catch {
    return false;
  }
}

/** Directorios candidatos donde vive el backend embebido (portable / instalado). */
function getEmbeddedBackendDirCandidates() {
  const dirs = [];
  try {
    const { app } = require("electron");
    if (process.resourcesPath) {
      dirs.push(path.join(process.resourcesPath, "backend"));
    }
    if (app && typeof app.getPath === "function") {
      const exeDir = path.dirname(app.getPath("exe"));
      dirs.push(path.join(exeDir, "resources", "backend"));
    }
  } catch {
    if (process.resourcesPath) {
      dirs.push(path.join(process.resourcesPath, "backend"));
    }
  }
  return [...new Set(dirs.filter(Boolean))];
}

/** Ruta preferida solo para diagnóstico (archivo que debería existir en el portable). */
function getPreferredEmbeddedEnvPathForDiag() {
  try {
    return path.join(process.resourcesPath, "backend", "env.embedded");
  } catch {
    return null;
  }
}

function probeBackendEnvFiles(triedDirs) {
  const out = {};
  for (const d of triedDirs) {
    const emb = path.join(d, "env.embedded");
    const dot = path.join(d, ".env");
    out[d] = {
      envEmbeddedPath: emb,
      envEmbeddedExists: fs.existsSync(emb),
      dotEnvPath: dot,
      dotEnvExists: fs.existsSync(dot),
    };
  }
  return out;
}

function buildPackagedReadError(triedDirs) {
  const probe = probeBackendEnvFiles(triedDirs);
  const lines = [
    "No se pudo leer LICENSE_HMAC_SECRET desde env.embedded ni .env en resources/backend.",
    "Directorios probados: " + (triedDirs.length ? triedDirs.join(" | ") : "(ninguno — process.resourcesPath?)"),
  ];
  for (const d of triedDirs) {
    const p = probe[d];
    if (!p) continue;
    lines.push(
      ` · ${d}: env.embedded existe=${p.envEmbeddedExists} · .env existe=${p.dotEnvExists}`,
    );
  }
  lines.push(
    "Causa frecuente: LICENSE_HMAC_SECRET en la misma línea que un comentario # con solo \\r (CR) como salto; normalice a LF o CRLF.",
  );
  return new Error(lines.join("\n"));
}

/** @type {string | undefined} undefined = aún no cargado */
let _cachedPackagedSecret;

/** @type {string | null | undefined} */
let _cachedPackagedPathUsed;

const MIN_HMAC_SECRET_LEN = 16;

function readPackagedSecretFromDisk() {
  const candidates = getEmbeddedBackendDirCandidates();
  for (const dir of candidates) {
    const hit = readLicenseHmacFromBackendDir(dir);
    if (hit && String(hit.secret).trim().length >= MIN_HMAC_SECRET_LEN) {
      return { secret: hit.secret.trim(), pathUsed: hit.pathUsed, triedDirs: candidates };
    }
  }
  return { secret: null, pathUsed: null, triedDirs: candidates };
}

function getLicenseHmacSecret() {
  if (isPackagedElectron()) {
    if (_cachedPackagedSecret !== undefined) {
      return _cachedPackagedSecret;
    }
    const { secret: s, pathUsed, triedDirs } = readPackagedSecretFromDisk();
    if (s) {
      _cachedPackagedSecret = s;
      _cachedPackagedPathUsed = pathUsed;
      return s;
    }
    throw buildPackagedReadError(triedDirs);
  }
  const e = (process.env.LICENSE_HMAC_SECRET || "").trim();
  return e || "PVQ-DESKTOP-LICENSE-CHANGE-ME-IN-CI";
}

/**
 * Snapshot para diagnóstico (no expone el secreto).
 */
function getLicenseHmacDiagnosticSnapshot() {
  const packaged = isPackagedElectron();
  if (!packaged) {
    const secret = getLicenseHmacSecret();
    return {
      role: "electron-main",
      source: "process.env (desarrollo)",
      envPath: "(dev)",
      pathUsed: null,
      triedBackendDirs: [],
      backendEnvFiles: {},
      secretLength: String(secret).length,
      fingerprintSha256Prefix16: fingerprintSecret(secret),
      isPlaceholderDefault: looksLikePlaceholderSecret(secret),
      readFailed: false,
    };
  }

  const disk = readPackagedSecretFromDisk();
  const triedBackendDirs = disk.triedDirs;
  const backendEnvFiles = probeBackendEnvFiles(triedBackendDirs);

  if (!disk.secret) {
    return {
      role: "electron-main",
      source: "env.embedded o .env en resources/backend (ignora process.env)",
      envPath: getPreferredEmbeddedEnvPathForDiag(),
      pathUsed: null,
      triedBackendDirs,
      backendEnvFiles,
      secretLength: 0,
      fingerprintSha256Prefix16: "empty",
      isPlaceholderDefault: false,
      readFailed: true,
      readFailureMessage: buildPackagedReadError(triedBackendDirs).message,
    };
  }

  const secret = disk.secret;
  _cachedPackagedSecret = secret;
  _cachedPackagedPathUsed = disk.pathUsed;

  return {
    role: "electron-main",
    source: "env.embedded o .env en resources/backend (ignora process.env)",
    envPath: getPreferredEmbeddedEnvPathForDiag(),
    pathUsed: disk.pathUsed,
    triedBackendDirs,
    backendEnvFiles,
    secretLength: String(secret).length,
    fingerprintSha256Prefix16: fingerprintSecret(secret),
    isPlaceholderDefault: looksLikePlaceholderSecret(secret),
    readFailed: false,
  };
}

function fingerprintSecret(secret) {
  if (!secret) return "empty";
  return crypto.createHash("sha256").update(String(secret), "utf8").digest("hex").slice(0, 16);
}

module.exports = {
  getLicenseHmacSecret,
  getLicenseHmacDiagnosticSnapshot,
  fingerprintSecret,
};
