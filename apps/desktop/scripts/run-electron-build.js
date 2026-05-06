/**
 * Ejecuta electron-builder escribiendo en dist/electron-out-<timestamp>/win-unpacked
 * para NO reutilizar carpetas bloqueadas por un .exe o app.asar en uso.
 */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { desktopRoot, distRoot, manifestPath } = require("./build-paths");

function main() {
  if (!fs.existsSync(distRoot)) {
    fs.mkdirSync(distRoot, { recursive: true });
  }

  const electronOut = path.join(distRoot, `electron-out-${Date.now()}`);
  fs.mkdirSync(electronOut, { recursive: true });

  const relOut = path.relative(desktopRoot, electronOut).split(path.sep).join("/");
  console.log("[run-electron-build] Salida electron-builder:", electronOut);
  console.log("[run-electron-build] Relativo:", relOut);

  const releaseSign = process.env.DESKTOP_RELEASE_SIGN === "1";
  const forceSignArg = releaseSign ? " --config.forceCodeSigning=true" : "";
  if (releaseSign) {
    console.log("[run-electron-build] Modo release firmado: forceCodeSigning=true (requiere CSC_LINK / CSC_KEY_PASSWORD).");
  }

  const cmd = `npx electron-builder --config.directories.output=${relOut}${forceSignArg}`;
  try {
    execSync(cmd, {
      cwd: desktopRoot,
      stdio: "inherit",
      shell: true,
      env: { ...process.env },
    });
  } catch (e) {
    console.error("[run-electron-build] electron-builder falló.");
    process.exit(e.status ?? 1);
  }

  const winUnpacked = path.join(electronOut, "win-unpacked");
  if (!fs.existsSync(winUnpacked)) {
    console.error("[run-electron-build] Falta win-unpacked en:", winUnpacked);
    process.exit(1);
  }
  const exes = fs.readdirSync(winUnpacked).filter((n) => n.endsWith(".exe") && !/^uninst/i.test(n));
  if (!exes.length) {
    console.error("[run-electron-build] No hay .exe en:", winUnpacked);
    process.exit(1);
  }

  const manifest = {
    electronOutputDir: electronOut,
    winUnpacked,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log("[run-electron-build] Manifiesto:", manifestPath);
  console.log("[run-electron-build] OK");
}

main();
