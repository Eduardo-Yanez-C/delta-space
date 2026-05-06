/**
 * SOLO PRUEBAS INTERNAS: solo si runtime-v1.json tiene mode=trial (instalaciones antiguas).
 * Marca trialEndsAt en el pasado y re-firma con el mismo HMAC. Cierra la app antes de ejecutar.
 *
 * En equipos nuevos ya no existe trial automático: para ver pantalla de licencia, borre
 * runtime-v1.json o use un equipo sin ese archivo.
 *
 * Uso (Windows):
 *   node scripts/simulate-trial-expired.js "C:\Users\TU_USUARIO\AppData\Roaming\desktop\license\runtime-v1.json"
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function getSecret() {
  return process.env.LICENSE_HMAC_SECRET || "PVQ-DESKTOP-LICENSE-CHANGE-ME-IN-CI";
}

function canonicalStringify(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function signPayload(payload) {
  return crypto.createHmac("sha256", getSecret()).update(canonicalStringify(payload)).digest("hex");
}

const statePath = process.argv[2];
if (!statePath || !fs.existsSync(statePath)) {
  console.error("Uso: node simulate-trial-expired.js <ruta\\runtime-v1.json>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(statePath, "utf8"));
if (!raw.payload || raw.payload.mode !== "trial") {
  console.error("El estado no es mode=trial. No se modifica.");
  process.exit(1);
}

const past = new Date("2000-01-01T12:00:00.000Z").toISOString();
raw.payload.trialEndsAt = past;
raw.payload.activationAt = raw.payload.activationAt || past;
raw.sig = signPayload(raw.payload);
fs.writeFileSync(statePath, JSON.stringify(raw, null, 0), "utf8");
console.log("OK: trialEndsAt =", past, "— reinicie la app (debe bloquearse).");
