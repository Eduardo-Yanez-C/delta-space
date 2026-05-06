/**
 * Descarga Node.js portable para la plataforma actual y lo deja en
 * apps/desktop/node-portable/<platform>/ para que electron-builder lo empaquete.
 * Solo Windows x64 en esta versión.
 *
 * Uso: node scripts/download-node-portable.js
 * (ejecutar desde apps/desktop, p. ej. npm run download-node)
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const NODE_VERSION = "20.18.0";
const PLATFORM = process.platform;
const ARCH = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : "x64";

const DESKTOP_ROOT = path.join(__dirname, "..");
const NODE_PORTABLE_DIR = path.join(DESKTOP_ROOT, "node-portable", "win32-x64");

function download(url) {
  return new Promise((resolve, reject) => {
    const file = path.join(DESKTOP_ROOT, "node-portable", "node-download.zip");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const stream = fs.createWriteStream(file);
    https
      .get(url, { headers: { "User-Agent": "Node-Portable-Download/1.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          stream.close();
          fs.unlinkSync(file);
          download(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          stream.close();
          fs.unlinkSync(file);
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
          return;
        }
        res.pipe(stream);
        stream.on("finish", () => {
          stream.close();
          resolve(file);
        });
      })
      .on("error", (err) => {
        stream.close();
        if (fs.existsSync(file)) fs.unlinkSync(file);
        reject(err);
      });
  });
}

function extractZip(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );
}

async function main() {
  if (PLATFORM !== "win32") {
    console.log("Node portable: solo Windows está implementado. Saltando descarga.");
    process.exit(0);
  }

  if (ARCH !== "x64") {
    console.log("Node portable: solo x64 está implementado. Saltando descarga.");
    process.exit(0);
  }

  const dirName = `node-v${NODE_VERSION}-win-x64`;
  const zipUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${dirName}.zip`;

  try {
    console.log("Descargando Node", NODE_VERSION, "para win32-x64...");
    const zipPath = await download(zipUrl);
    console.log("Extrayendo...");
    const extractTo = path.join(DESKTOP_ROOT, "node-portable", "extract");
    if (fs.existsSync(extractTo)) {
      fs.rmSync(extractTo, { recursive: true });
    }
    extractZip(zipPath, extractTo);
    const extractedFolder = path.join(extractTo, dirName);
    if (!fs.existsSync(extractedFolder)) {
      throw new Error("Carpeta extraída no encontrada: " + extractedFolder);
    }
    if (fs.existsSync(NODE_PORTABLE_DIR)) {
      fs.rmSync(NODE_PORTABLE_DIR, { recursive: true });
    }
    fs.mkdirSync(path.dirname(NODE_PORTABLE_DIR), { recursive: true });
    fs.renameSync(extractedFolder, NODE_PORTABLE_DIR);
    fs.rmSync(extractTo, { recursive: true, force: true });
    fs.unlinkSync(zipPath);
    const nodeExe = path.join(NODE_PORTABLE_DIR, "node.exe");
    if (!fs.existsSync(nodeExe)) {
      throw new Error("node.exe no encontrado en " + NODE_PORTABLE_DIR);
    }
    console.log("Node portable listo en", NODE_PORTABLE_DIR);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
