/**
 * Servidor de EJEMPLO para POST /v1/desktop-developer-license
 * SOLO laboratorio local. No usar en producción sin TLS, bcrypt, BD y rate limiting reales.
 *
 * Requisitos: Node 18+
 * Mismo LICENSE_HMAC_SECRET que el escritorio (y que generate-license.js).
 *
 * Variables de entorno:
 *   LICENSE_HMAC_SECRET   (obligatorio)
 *   ISSUER_PORT           default 8765
 *   ISSUER_EMAIL          email permitido (ej. eduardo.yanez.concha@gmail.com)
 *   ISSUER_PASSWORD       contraseña en texto (SOLO demo; en prod usar hash + BD)
 *   ISSUER_MAX_DAYS       default 30
 *
 * Arranque:
 *   set LICENSE_HMAC_SECRET=...
 *   set ISSUER_EMAIL=eduardo.yanez.concha@gmail.com
 *   set ISSUER_PASSWORD=...
 *   node scripts/dev-license-issuer-server.example.cjs
 *
 * Desktop (solo dev):
 *   set DESKTOP_DEV_LICENSE_ISSUER_URL=http://127.0.0.1:8765
 *   set DESKTOP_DEV_LICENSE_ISSUER_ALLOW_HTTP=1
 */

const http = require("http");
const crypto = require("crypto");

const LICENSE_ID_PATTERN = /^LIC-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const INSTALLATION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function canonicalStringify(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function signPayload(secret, payload) {
  return crypto.createHmac("sha256", secret).update(canonicalStringify(payload)).digest("hex");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const port = parseInt(process.env.ISSUER_PORT || "8765", 10);
const secret = process.env.LICENSE_HMAC_SECRET || "";
const issuerEmail = (process.env.ISSUER_EMAIL || "").trim().toLowerCase();
const issuerPassword = process.env.ISSUER_PASSWORD || "";
const maxDays = Math.min(90, Math.max(1, parseInt(process.env.ISSUER_MAX_DAYS || "30", 10)));

if (!secret) {
  console.error("Falta LICENSE_HMAC_SECRET");
  process.exit(1);
}
if (!issuerEmail || !issuerPassword) {
  console.error("Faltan ISSUER_EMAIL e ISSUER_PASSWORD (demo)");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/v1/desktop-developer-license") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: "JSON inválido" }));
      return;
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const installationId = typeof body.installationId === "string" ? body.installationId.trim() : "";
    const requestedDays = parseInt(String(body.requestedDays ?? ""), 10);

    if (!INSTALLATION_ID_RE.test(installationId)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: "installationId inválido" }));
      return;
    }
    if (Number.isNaN(requestedDays) || requestedDays < 1 || requestedDays > maxDays) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: `requestedDays debe ser 1..${maxDays}` }));
      return;
    }
    if (email !== issuerEmail || password !== issuerPassword) {
      res.statusCode = 401;
      res.end(JSON.stringify({ message: "No autorizado" }));
      return;
    }

    const d = new Date();
    d.setDate(d.getDate() + requestedDays);
    d.setHours(23, 59, 59, 999);
    const validUntilIso = d.toISOString();
    const licenseId = `LIC-DEV-${Date.now()}`;
    if (!LICENSE_ID_PATTERN.test(licenseId)) {
      res.statusCode = 500;
      res.end(JSON.stringify({ message: "internal" }));
      return;
    }

    const payload = {
      v: 1,
      kind: "renewal",
      licenseId,
      licenseType: "INTERNAL",
      installationId,
      validUntil: validUntilIso,
      issuedAt: new Date().toISOString(),
      issuedTo: email,
      note: "dev-issuer-example",
    };
    const record = { payload, sig: signPayload(secret, payload) };
    res.statusCode = 200;
    res.end(JSON.stringify(record));
    console.log(new Date().toISOString(), "emit", licenseId, installationId, requestedDays, "d");
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Dev issuer listening http://127.0.0.1:${port}/v1/desktop-developer-license`);
});
