/**
 * Comprueba que la carpeta portátil tenga integridad mínima (sin abrir el .exe).
 */
const fs = require("fs");
const path = require("path");
const { desktopRoot } = require("./build-paths");
const { readLicenseHmacFromDotenv } = require("./merge-desktop-build-env");

function assertFile(label, p) {
  if (!fs.existsSync(p)) {
    throw new Error(`[verify-portable] Falta ${label}: ${p}`);
  }
}

function assertSourceIncludesDevLicense() {
  const html = path.join(desktopRoot, "license-blocked.html");
  const main = path.join(desktopRoot, "main.js");
  assertFile("license-blocked.html (fuente)", html);
  assertFile("main.js (fuente)", main);
  const h = fs.readFileSync(html, "utf8");
  const m = fs.readFileSync(main, "utf8");
  const secretPath = path.join(desktopRoot, "license", "secret.js");
  const embeddedHmacPath = path.join(desktopRoot, "license", "embedded-hmac.js");
  assertFile("license/secret.js", secretPath);
  assertFile("license/embedded-hmac.js", embeddedHmacPath);
  const s = fs.readFileSync(secretPath, "utf8");
  const emb = fs.readFileSync(embeddedHmacPath, "utf8");
  if (!h.includes("Acceso desarrollador")) {
    throw new Error("[verify-portable] license-blocked.html no incluye «Acceso desarrollador».");
  }
  if (!m.includes("delete childEnv.LICENSE_HMAC_SECRET")) {
    throw new Error("[verify-portable] main.js debe quitar LICENSE_HMAC_SECRET del env del hijo Nest.");
  }
  const readsViaBackendDir =
    s.includes("readLicenseHmacFromBackendDir") && s.includes("./embedded-hmac");
  const readsDotenvFileDirect = s.includes("readLicenseHmacFromDotenvFile");
  if (!s.includes("isPackagedElectron") || (!readsViaBackendDir && !readsDotenvFileDirect)) {
    throw new Error(
      "[verify-portable] license/secret.js debe leer HMAC desde archivos embebidos al empaquetar (embedded-hmac: env.embedded / .env).",
    );
  }
  if (!emb.includes("env.embedded") || !emb.includes("readLicenseHmacFromBackendDir")) {
    throw new Error(
      "[verify-portable] license/embedded-hmac.js debe exponer lectura por directorio backend (env.embedded antes que .env).",
    );
  }
  if (!m.includes("127.0.0.1") || !m.includes("/api")) {
    throw new Error("[verify-portable] main.js no referencia URL embebida esperada hacia API.");
  }
}

/**
 * @param {string} portableDir
 * @param {{ allowPlaceholderSecret?: boolean }} [opts]
 */
function verifyPortableFolder(portableDir, opts = {}) {
  assertSourceIncludesDevLicense();

  assertFile("portable (directorio)", portableDir);
  const entries = fs.readdirSync(portableDir);
  const exe = entries.find((n) => n.endsWith(".exe") && !/^uninst/i.test(n));
  if (!exe) {
    throw new Error(`[verify-portable] No hay .exe en: ${portableDir}`);
  }

  assertFile("chrome_100_percent.pak", path.join(portableDir, "chrome_100_percent.pak"));
  assertFile("resources.pak", path.join(portableDir, "resources.pak"));
  assertFile("locales/", path.join(portableDir, "locales"));
  assertFile(
    "Next standalone server.js",
    path.join(portableDir, "resources", "standalone", "apps", "web", "server.js"),
  );
  const nodeExe = path.join(portableDir, "resources", "node", "node.exe");
  assertFile("Node portable", nodeExe);
  assertFile(
    "Backend dist/main.js",
    path.join(portableDir, "resources", "backend", "dist", "main.js"),
  );

  const envEmbeddedPath = path.join(portableDir, "resources", "backend", "env.embedded");
  assertFile("Backend env.embedded (HMAC para Electron)", envEmbeddedPath);
  const secret = readLicenseHmacFromDotenv(envEmbeddedPath);
  if (!secret || secret.length < 16) {
    throw new Error(
      "[verify-portable] LICENSE_HMAC_SECRET ausente en resources/backend/env.embedded",
    );
  }
  const envDotPath = path.join(portableDir, "resources", "backend", ".env");
  if (fs.existsSync(envDotPath)) {
    const fromDot = readLicenseHmacFromDotenv(envDotPath);
    if (fromDot && fromDot !== secret) {
      throw new Error(
        "[verify-portable] LICENSE_HMAC_SECRET distinto entre .env y env.embedded; deben ser idénticos.",
      );
    }
  }
  const looksPlaceholder =
    /MISMO_SECRETO_QUE_BUILD|CHANGE-ME-IN-CI|PVQ-DESKTOP-LICENSE-CHANGE-ME/i.test(secret);
  if (looksPlaceholder && !opts.allowPlaceholderSecret) {
    throw new Error(
      "[verify-portable] LICENSE_HMAC_SECRET es placeholder. Defina un valor real en apps/desktop/desktop-build.env (ver desktop-build.env.example) o en api/.env.desktop antes del build.",
    );
  }

  assertFile("app.asar", path.join(portableDir, "resources", "app.asar"));
  const st = fs.statSync(path.join(portableDir, "resources", "app.asar"));
  if (st.size < 5000) {
    throw new Error("[verify-portable] app.asar sospechosamente pequeño.");
  }

  return { exeName: exe };
}

module.exports = {
  verifyPortableFolder,
};
