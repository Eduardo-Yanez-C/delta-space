/**
 * Protección básica contra manipulación del reloj del sistema.
 * Persiste la última fecha/hora de pared vista en una sesión con licencia válida (firmada HMAC).
 * Si el reloj retrocede más de CLOCK_REWIND_TOLERANCE_MS respecto a ese ancla → fallo.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getLicenseHmacSecret } = require("./secret");

const LICENSE_HMAC_UNAVAILABLE = "LICENSE_HMAC_UNAVAILABLE";

const ANCHOR_VERSION = 1;
const ANCHOR_REL = path.join("license", `clock-anchor-v${ANCHOR_VERSION}.json`);
/** Retroceso máximo permitido del reloj (ms) antes de considerar manipulación. */
const CLOCK_REWIND_TOLERANCE_MS = 2 * 60 * 1000;

function getAnchorPath(userData) {
  return path.join(userData, ANCHOR_REL);
}

function canonicalStringify(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function signPayload(payload) {
  let secret;
  try {
    secret = getLicenseHmacSecret();
  } catch (e) {
    const w = new Error(LICENSE_HMAC_UNAVAILABLE);
    w.detail = e && e.message ? e.message : String(e);
    throw w;
  }
  return crypto.createHmac("sha256", secret).update(canonicalStringify(payload)).digest("hex");
}

function verifySignature(payload, sigHex) {
  if (!sigHex || typeof sigHex !== "string") return false;
  const expected = signPayload(payload);
  try {
    const a = Buffer.from(sigHex, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function loadAnchor(userData) {
  const p = getAnchorPath(userData);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAnchor(userData, record) {
  const p = getAnchorPath(userData);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(record, null, 0), "utf8");
}

/**
 * Comprueba el reloj antes de considerar la licencia válida.
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkClockNotRewound(userData, nowMs = Date.now()) {
  const raw = loadAnchor(userData);
  if (!raw || !raw.payload || !raw.sig) {
    return { ok: true };
  }
  let anchorOk;
  try {
    anchorOk = verifySignature(raw.payload, raw.sig);
  } catch (e) {
    if (e && e.message === LICENSE_HMAC_UNAVAILABLE) {
      return { ok: false, reason: "hmac_read_error", detail: e.detail || String(e) };
    }
    throw e;
  }
  if (!anchorOk) {
    return { ok: false, reason: "clock_anchor_tamper" };
  }
  const pl = raw.payload;
  if (pl.v !== ANCHOR_VERSION || typeof pl.lastSeenAtMs !== "number") {
    return { ok: false, reason: "clock_anchor_corrupt" };
  }
  if (nowMs + CLOCK_REWIND_TOLERANCE_MS < pl.lastSeenAtMs) {
    return { ok: false, reason: "clock_rewind_suspected" };
  }
  return { ok: true };
}

/**
 * Tras validar licencia OK, actualiza el ancla al máximo entre valor guardado y ahora.
 */
function touchAnchor(userData, nowMs = Date.now()) {
  let last = 0;
  const raw = loadAnchor(userData);
  try {
    if (raw?.payload && raw.sig && verifySignature(raw.payload, raw.sig) && typeof raw.payload.lastSeenAtMs === "number") {
      last = raw.payload.lastSeenAtMs;
    }
  } catch (e) {
    if (e && e.message === LICENSE_HMAC_UNAVAILABLE) {
      return;
    }
    throw e;
  }
  const next = Math.max(last, nowMs);
  const payload = { v: ANCHOR_VERSION, lastSeenAtMs: next };
  let sig;
  try {
    sig = signPayload(payload);
  } catch (e) {
    if (e && e.message === LICENSE_HMAC_UNAVAILABLE) {
      return;
    }
    throw e;
  }
  saveAnchor(userData, { payload, sig });
}

module.exports = {
  checkClockNotRewound,
  touchAnchor,
  CLOCK_REWIND_TOLERANCE_MS,
};
