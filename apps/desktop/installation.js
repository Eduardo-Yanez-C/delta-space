/**
 * Identidad estable de instalación (MVP1) para licenciamiento fuerte (JWT + binding).
 * Persistido en userData de Electron — no en carpeta portable compartida.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const INSTALL_REL = path.join("installation", "installation.json");

function installationPath(userData) {
  return path.join(userData, INSTALL_REL);
}

/**
 * @returns {{ installationId: string, createdAt: string }}
 */
function getOrCreateInstallationRecord(userData) {
  const p = installationPath(userData);
  if (fs.existsSync(p)) {
    try {
      const raw = fs.readFileSync(p, "utf8");
      const j = JSON.parse(raw);
      if (j && typeof j.installationId === "string" && j.installationId.length >= 8) {
        return { installationId: j.installationId, createdAt: j.createdAt || "" };
      }
    } catch (_) {
      /* regenerar */
    }
  }
  const installationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    p,
    JSON.stringify({ v: 1, installationId, createdAt }, null, 0),
    "utf8",
  );
  return { installationId, createdAt };
}

module.exports = {
  getOrCreateInstallationRecord,
  installationPath,
};
