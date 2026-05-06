/**
 * Utilidades para Windows: renombrar en lugar de borrar cuando hay locks (EPERM/EBUSY).
 */
const fs = require("fs");
const path = require("path");

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* sync wait — suficiente para reintentos cortos entre locks de Windows */
  }
}

/**
 * @param {string} from
 * @param {string} to
 * @param {{ retries?: number, delayMs?: number }} [opts]
 * @returns {boolean}
 */
function renameWithRetry(from, to, opts = {}) {
  const retries = opts.retries ?? 12;
  const delayMs = opts.delayMs ?? 500;
  for (let i = 0; i < retries; i++) {
    try {
      if (!fs.existsSync(from)) {
        return false;
      }
      fs.renameSync(from, to);
      return true;
    } catch (err) {
      const code = err && err.code;
      if (code === "ENOENT" && !fs.existsSync(from)) return false;
      if (i === retries - 1) {
        return false;
      }
      sleep(delayMs);
    }
  }
  return false;
}

/**
 * Mueve `dir` a dir.__stale__.timestamp (no borra; evita locks en delete recursivo).
 * @param {string} dir
 * @returns {boolean} false si no se pudo mover
 */
function relocateDir(dir) {
  if (!fs.existsSync(dir)) return true;
  const parent = path.dirname(dir);
  const base = path.basename(dir);
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dest = path.join(parent, `${base}.__stale__.${stamp}`);
  return renameWithRetry(dir, dest);
}

module.exports = {
  sleep,
  renameWithRetry,
  relocateDir,
};
