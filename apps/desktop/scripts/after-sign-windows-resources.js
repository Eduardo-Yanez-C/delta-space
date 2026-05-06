/**
 * Hook afterSign (electron-builder): firma .exe en extraResources que el flujo estándar
 * no siempre incluye (lan-p2p.exe, node.exe portable).
 *
 * Requisitos en la máquina de build: Windows SDK (signtool en PATH o SIGNTOOL_PATH).
 * Mismos secretos que electron-builder: CSC_LINK / CSC_KEY_PASSWORD (o WIN_*).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync, execSync } = require("child_process");

const TIMESTAMP_URL = process.env.SIGN_TIMESTAMP_URL || "http://timestamp.digicert.com";

function findSigntool() {
  if (process.env.SIGNTOOL_PATH && fs.existsSync(process.env.SIGNTOOL_PATH)) {
    return process.env.SIGNTOOL_PATH;
  }
  try {
    const out = execSync("where signtool", { encoding: "utf8", shell: true });
    const first = out
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && fs.existsSync(l));
    if (first) return first;
  } catch {
    /* */
  }
  return null;
}

function resolvePfxPath() {
  const link = (process.env.CSC_LINK || process.env.WIN_CSC_LINK || "").trim();
  if (!link) return null;
  if (fs.existsSync(link)) return { path: link, cleanup: null };
  try {
    const buf = Buffer.from(link, "base64");
    if (buf.length < 100) return null;
    const tmp = path.join(os.tmpdir(), `pv-desktop-csc-${process.pid}-${Date.now()}.pfx`);
    fs.writeFileSync(tmp, buf);
    return { path: tmp, cleanup: () => fs.unlinkSync(tmp) };
  } catch {
    return null;
  }
}

module.exports = async function afterSignWindowsResources(context) {
  if (context.electronPlatformName !== "win32") return;

  const appOutDir = context.appOutDir;
  if (!appOutDir || !fs.existsSync(appOutDir)) return;

  const candidates = [
    path.join(appOutDir, "resources", "lan-p2p", "lan-p2p.exe"),
    path.join(appOutDir, "resources", "node", "node.exe"),
  ].filter((p) => fs.existsSync(p));

  if (!candidates.length) return;

  const pfx = resolvePfxPath();
  const password = process.env.CSC_KEY_PASSWORD || process.env.WIN_CSC_KEY_PASSWORD || "";
  const releaseSign = process.env.DESKTOP_RELEASE_SIGN === "1";

  if (!pfx) {
    if (releaseSign) {
      console.warn(
        "[after-sign-windows-resources] DESKTOP_RELEASE_SIGN=1 pero falta CSC_LINK / WIN_CSC_LINK: no se firman lan-p2p.exe ni node.exe.",
      );
    }
    return;
  }

  const signtool = findSigntool();
  if (!signtool) {
    if (releaseSign) {
      console.warn(
        "[after-sign-windows-resources] signtool no encontrado (Windows SDK o SIGNTOOL_PATH). Omitiendo firma de recursos extra.",
      );
    }
    if (pfx.cleanup) pfx.cleanup();
    return;
  }

  try {
    for (const exe of candidates) {
      const args = [
        "sign",
        "/f",
        pfx.path,
        "/p",
        password,
        "/tr",
        TIMESTAMP_URL,
        "/td",
        "sha256",
        "/fd",
        "sha256",
        exe,
      ];
      console.log("[after-sign-windows-resources] Firmando:", path.relative(appOutDir, exe));
      execFileSync(signtool, args, { stdio: "inherit" });
    }
  } finally {
    if (pfx.cleanup) {
      try {
        pfx.cleanup();
      } catch {
        /* */
      }
    }
  }
};

module.exports.default = module.exports;
