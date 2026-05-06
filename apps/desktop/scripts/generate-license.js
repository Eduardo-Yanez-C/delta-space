/**
 * Genera un archivo de licencia de renovación firmado (HMAC-SHA256).
 * Debe usarse el mismo LICENSE_HMAC_SECRET que en la app empaquetada.
 *
 * Uso:
 *   cd apps/desktop
 *   set LICENSE_HMAC_SECRET=tu-secreto
 *   node scripts/generate-license.js --id LIC-COMM-2026-0042 --until 2026-12-31 --out licencia.json
 *
 * Prueba de N días hábiles (misma regla que antes tenía el trial automático: lun–vie):
 *   node scripts/generate-license.js --id LIC-TRIAL-0001 --business-days 5 --type TRIAL_EXTENSION --out prueba.json
 *
 * Piloto por equipo (installationId + duración en días civiles):
 *   node scripts/generate-license.js --id LIC-PILOT-001 --installation-id <UUID-de-la-app> --calendar-days 5 --out licencia.json
 *
 * Opciones:
 *   --id ID              identificador visible (obligatorio)
 *   --installation-id    UUID del equipo (obligatorio para licencias nuevas; ver pantalla de licencia en la app)
 *   --until YYYY-MM-DD   fecha fin (fin del día local, 23:59:59)
 *   --business-days N    fin del N-ésimo día hábil desde hoy (lun–vie)
 *   --calendar-days N    fin del día civil tras sumar N días al día de hoy (23:59:59.999 local) — típico piloto 5 días
 *   Debe indicar exactamente uno de: --until | --business-days | --calendar-days
 *   --type TIPO          COMMERCIAL | TRIAL_EXTENSION | INTERNAL | PARTNER (default: COMMERCIAL)
 *   --to TEXTO           issuedTo (opcional)
 *   --nota TEXTO         nota interna (opcional)
 *   --out ruta           archivo de salida (default: stdout JSON)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getLicenseHmacSecret } = require("../license/secret");
const { isValidLicenseId, isValidInstallationId, LICENSE_TYPES, TRIAL_BUSINESS_DAYS } = require("../license/state");
const { endOfNthBusinessDayFromActivation } = require("../license/business-days");

function canonicalStringify(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function signPayload(payload) {
  return crypto.createHmac("sha256", getLicenseHmacSecret()).update(canonicalStringify(payload)).digest("hex");
}

function parseArgs() {
  const a = process.argv.slice(2);
  const out = {
    id: null,
    installationId: null,
    until: null,
    businessDays: null,
    calendarDays: null,
    type: "COMMERCIAL",
    to: null,
    note: null,
    outPath: null,
  };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--id" && a[i + 1]) {
      out.id = a[i + 1];
      i++;
    } else if (a[i] === "--installation-id" && a[i + 1]) {
      out.installationId = a[i + 1];
      i++;
    } else if (a[i] === "--until" && a[i + 1]) {
      out.until = a[i + 1];
      i++;
    } else if (a[i] === "--business-days" && a[i + 1]) {
      out.businessDays = a[i + 1];
      i++;
    } else if (a[i] === "--calendar-days" && a[i + 1]) {
      out.calendarDays = a[i + 1];
      i++;
    } else if (a[i] === "--type" && a[i + 1]) {
      out.type = a[i + 1].trim().toUpperCase();
      i++;
    } else if (a[i] === "--to" && a[i + 1]) {
      out.to = a[i + 1];
      i++;
    } else if (a[i] === "--nota" && a[i + 1]) {
      out.note = a[i + 1];
      i++;
    } else if (a[i] === "--out" && a[i + 1]) {
      out.outPath = a[i + 1];
      i++;
    }
  }
  return out;
}

function main() {
  const { id, installationId, until, businessDays, calendarDays, type, to, note, outPath } = parseArgs();
  if (!id) {
    console.error("Falta --id LIC-...");
    process.exit(1);
  }
  if (!installationId || !isValidInstallationId(installationId)) {
    console.error("Falta o es inválido --installation-id <UUID> (copie el ID de instalación desde la pantalla de licencia de la app).");
    process.exit(1);
  }
  const modes = [until != null, businessDays != null, calendarDays != null].filter(Boolean);
  if (modes.length !== 1) {
    console.error("Debe indicar exactamente uno de: --until YYYY-MM-DD | --business-days N | --calendar-days N");
    process.exit(1);
  }

  const licenseId = id.trim();
  if (!isValidLicenseId(licenseId)) {
    console.error(
      "Identificador inválido. Debe coincidir con el patrón LIC-… (mín. 6 caracteres tras LIC-, solo caracteres permitidos).",
    );
    process.exit(1);
  }
  if (!LICENSE_TYPES.has(type)) {
    console.error("Tipo inválido. Use uno de:", [...LICENSE_TYPES].join(", "));
    process.exit(1);
  }

  let validUntilIso;
  if (until) {
    const d = new Date(until + "T23:59:59");
    if (Number.isNaN(d.getTime())) {
      console.error("Fecha inválida:", until);
      process.exit(1);
    }
    validUntilIso = d.toISOString();
  } else if (businessDays != null) {
    const n = parseInt(String(businessDays), 10);
    if (Number.isNaN(n) || n < 1 || n > 365) {
      console.error("--business-days debe ser un entero entre 1 y 365.");
      process.exit(1);
    }
    validUntilIso = endOfNthBusinessDayFromActivation(new Date(), n).toISOString();
    if (type === "COMMERCIAL" && n === TRIAL_BUSINESS_DAYS) {
      console.log(
        "(Sugerencia: para licencias de prueba use --type TRIAL_EXTENSION; tipo actual:",
        type + ")",
      );
    }
  } else {
    const n = parseInt(String(calendarDays), 10);
    if (Number.isNaN(n) || n < 1 || n > 366) {
      console.error("--calendar-days debe ser un entero entre 1 y 366.");
      process.exit(1);
    }
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(23, 59, 59, 999);
    validUntilIso = d.toISOString();
  }

  const issuedTo = to != null && String(to).trim() !== "" ? String(to).trim() : null;
  const payload = {
    v: 1,
    kind: "renewal",
    licenseId,
    licenseType: type,
    installationId: installationId.trim(),
    validUntil: validUntilIso,
    issuedAt: new Date().toISOString(),
  };
  if (issuedTo) payload.issuedTo = issuedTo;
  if (note != null && String(note).trim() !== "") payload.note = String(note).trim();
  else {
    payload.note =
      calendarDays != null
        ? `Piloto ${calendarDays} día(s) civiles — generate-license.js`
        : businessDays != null
          ? `Prueba ${businessDays} día(s) hábil(es) — generate-license.js`
          : "Emitido por scripts/generate-license.js";
  }

  const record = { payload, sig: signPayload(payload) };
  const json = JSON.stringify(record, null, 2);
  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), json, "utf8");
    console.log("Escrito:", path.resolve(outPath));
    console.log("licenseId:", licenseId, "| válido hasta:", payload.validUntil);
  } else {
    console.log(json);
  }
}

main();
