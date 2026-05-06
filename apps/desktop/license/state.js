const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getLicenseHmacSecret } = require("./secret");
const { endOfNthBusinessDayFromActivation } = require("./business-days");

const STATE_VERSION = 1;
const TRIAL_BUSINESS_DAYS = 5;
const STATE_REL = path.join("license", `runtime-v${STATE_VERSION}.json`);

/** Licencias comerciales: identificador visible (ej. LIC-TRIAL-0001, LIC-COMM-2026-0042) */
const LICENSE_ID_PATTERN = /^LIC-[A-Za-z0-9][A-Za-z0-9._-]*$/;

const LICENSE_TYPES = new Set(["COMMERCIAL", "TRIAL_EXTENSION", "INTERNAL", "PARTNER"]);

/** Marcador si getLicenseHmacSecret() falla en empaquetado (sin fallback). */
const LICENSE_HMAC_UNAVAILABLE = "LICENSE_HMAC_UNAVAILABLE";

function isValidLicenseId(id) {
  return typeof id === "string" && id.trim().length >= 6 && LICENSE_ID_PATTERN.test(id.trim());
}

function getStatePath(userData) {
  return path.join(userData, STATE_REL);
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

/**
 * Diagnóstico (no exponer el secreto). Usar con DESKTOP_LICENSE_DEBUG=1.
 * @param {{ payload: object, sig: string }} parsed
 * @param {string} [localInstallationId]
 */
function describeLicenseSignatureCheck(parsed, localInstallationId) {
  let secret;
  try {
    secret = getLicenseHmacSecret();
  } catch (e) {
    return {
      error: "hmac_unavailable",
      detail: e && e.message ? e.message : String(e),
    };
  }
  const pl = parsed && parsed.payload;
  const recv = parsed && parsed.sig != null ? String(parsed.sig).trim() : "";
  if (!pl || typeof pl !== "object") {
    return { error: "no_payload", secretLength: String(secret).length };
  }
  const canon = canonicalStringify(pl);
  const expected = crypto.createHmac("sha256", secret).update(canon).digest("hex");
  return {
    verifyOk: expected === recv,
    secretLength: String(secret).length,
    installationIdPayload: pl.installationId != null ? String(pl.installationId).trim() : null,
    installationIdLocal: localInstallationId != null ? String(localInstallationId).trim() : null,
    installationIdsMatch:
      localInstallationId != null &&
      pl.installationId != null &&
      String(pl.installationId).trim() === String(localInstallationId).trim(),
    validUntil: pl.validUntil != null ? String(pl.validUntil) : null,
    payloadV: pl.v,
    payloadVType: typeof pl.v,
    canonicalLength: canon.length,
    canonicalPreview: canon.length > 200 ? canon.slice(0, 200) + "…" : canon,
    expectedSigPrefix: expected.slice(0, 24),
    receivedSigPrefix: recv.slice(0, 24),
  };
}

/**
 * Crea estado local `mode: trial` (solo uso heredado / pruebas con simulate-trial-expired).
 * La app empaquetada ya NO crea trial automáticamente en el primer arranque.
 */
function createTrialState(activationDate) {
  const activationAt = activationDate.toISOString();
  const trialEndsAt = endOfNthBusinessDayFromActivation(activationDate, TRIAL_BUSINESS_DAYS).toISOString();
  const payload = {
    v: STATE_VERSION,
    mode: "trial",
    activationAt,
    trialEndsAt,
  };
  return { payload, sig: signPayload(payload) };
}

function saveState(userData, record) {
  const dir = path.dirname(getStatePath(userData));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getStatePath(userData), JSON.stringify(record, null, 0), "utf8");
}

function loadState(userData) {
  const p = getStatePath(userData);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Días completos restantes hasta el instante validUntil (firma de la licencia). Sin contador artificial.
 * @param {string} validUntilIso
 * @param {number} nowMs
 * @returns {number}
 */
function wholeDaysRemaining(validUntilIso, nowMs = Date.now()) {
  const end = Date.parse(validUntilIso);
  if (Number.isNaN(end)) return 0;
  if (nowMs >= end) return 0;
  return Math.max(1, Math.ceil((end - nowMs) / 86400000));
}

/**
 * @param {object} record
 * @param {{ installationId?: string, nowMs?: number }} [ctx]
 * @returns {{ ok: boolean, reason?: string, payload?: object, record?: object }}
 */
function validateStoredState(record, ctx) {
  if (!record || !record.payload || !record.sig) {
    return { ok: false, reason: "missing_or_corrupt" };
  }
  let sigOk;
  try {
    sigOk = verifySignature(record.payload, record.sig);
  } catch (e) {
    if (e && e.message === LICENSE_HMAC_UNAVAILABLE) {
      return { ok: false, reason: "hmac_read_error", detail: e.detail || String(e) };
    }
    throw e;
  }
  if (!sigOk) {
    return { ok: false, reason: "tamper" };
  }
  const p = record.payload;
  if (p.v !== STATE_VERSION) {
    return { ok: false, reason: "version" };
  }
  const now = ctx?.nowMs ?? Date.now();
  const installId = ctx?.installationId;

  if (p.mode === "trial") {
    const end = Date.parse(p.trialEndsAt);
    if (Number.isNaN(end)) return { ok: false, reason: "bad_date" };
    if (now > end) return { ok: false, reason: "trial_expired", payload: p, record };
    return { ok: true, payload: p, record };
  }
  if (p.mode === "renewal") {
    if (installId && typeof p.installationId === "string" && p.installationId.trim() !== "") {
      if (p.installationId.trim() !== installId.trim()) {
        return { ok: false, reason: "wrong_installation", payload: p, record };
      }
    }
    const end = Date.parse(p.validUntil);
    if (Number.isNaN(end)) return { ok: false, reason: "bad_date" };
    if (now > end) return { ok: false, reason: "renewal_expired", payload: p, record };
    return { ok: true, payload: p, record };
  }
  return { ok: false, reason: "unknown_mode" };
}

const INSTALLATION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidInstallationId(id) {
  return typeof id === "string" && INSTALLATION_ID_RE.test(id.trim());
}

/**
 * Verifica archivo de licencia emitido externamente (misma firma HMAC sobre payload).
 * Payload mínimo: v, kind, licenseId, licenseType, validUntil, issuedAt, installationId (UUID v4), firma.
 * issuedTo opcional (control comercial).
 * @param {object} parsed
 * @param {string} currentInstallationId - Debe coincidir con payload.installationId (piloto por equipo).
 */
function validateExternalLicenseFile(parsed, currentInstallationId) {
  if (!parsed || !parsed.payload || !parsed.sig) {
    return { ok: false, reason: "invalid_file" };
  }
  let sigOk;
  try {
    sigOk = verifySignature(parsed.payload, parsed.sig);
  } catch (e) {
    if (e && e.message === LICENSE_HMAC_UNAVAILABLE) {
      return { ok: false, reason: "hmac_read_error", detail: e.detail || String(e) };
    }
    throw e;
  }
  if (!sigOk) {
    return { ok: false, reason: "bad_signature" };
  }
  const pl = parsed.payload;
  if (pl.v !== STATE_VERSION) return { ok: false, reason: "version" };
  if (pl.kind !== "renewal") return { ok: false, reason: "kind" };
  const licenseId = typeof pl.licenseId === "string" ? pl.licenseId.trim() : "";
  if (!isValidLicenseId(licenseId)) {
    return { ok: false, reason: "no_license_id" };
  }
  const licenseType = typeof pl.licenseType === "string" ? pl.licenseType.trim().toUpperCase() : "COMMERCIAL";
  if (!LICENSE_TYPES.has(licenseType)) {
    return { ok: false, reason: "bad_license_type" };
  }
  const extInst =
    typeof pl.installationId === "string" && pl.installationId.trim() !== "" ? pl.installationId.trim() : "";
  if (!isValidInstallationId(extInst)) {
    return { ok: false, reason: "no_installation_id" };
  }
  if (!currentInstallationId || extInst !== String(currentInstallationId).trim()) {
    return { ok: false, reason: "installation_mismatch" };
  }
  const issuedTo =
    pl.issuedTo != null && String(pl.issuedTo).trim() !== ""
      ? String(pl.issuedTo).trim()
      : null;
  const validUntil = pl.validUntil;
  if (!validUntil) return { ok: false, reason: "no_valid_until" };
  const end = Date.parse(validUntil);
  if (Number.isNaN(end) || Date.now() > end) {
    return { ok: false, reason: "already_expired" };
  }
  const newPayload = {
    v: STATE_VERSION,
    mode: "renewal",
    licenseId,
    licenseType,
    installationId: extInst,
    issuedTo,
    validUntil,
    issuedAt: pl.issuedAt || new Date().toISOString(),
    note: pl.note != null && String(pl.note).trim() !== "" ? String(pl.note).trim() : null,
  };
  return {
    ok: true,
    record: { payload: newPayload, sig: signPayload(newPayload) },
    meta: { licenseId, licenseType, issuedTo, installationId: extInst },
  };
}

module.exports = {
  getStatePath,
  createTrialState,
  saveState,
  loadState,
  validateStoredState,
  validateExternalLicenseFile,
  describeLicenseSignatureCheck,
  wholeDaysRemaining,
  isValidInstallationId,
  TRIAL_BUSINESS_DAYS,
  LICENSE_TYPES,
  isValidLicenseId,
  LICENSE_ID_PATTERN,
};
