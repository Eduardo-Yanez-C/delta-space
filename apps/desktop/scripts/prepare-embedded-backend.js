/**
 * Prepara la carpeta embed-api con el backend Nest compilado, prisma y node_modules
 * de producción para empaquetarlo en resources/backend.
 * Requiere: npm run build --workspace=api y prisma generate ya ejecutados (o se ejecutan aquí).
 * Ejecutar desde la raíz del monorepo o desde apps/desktop.
 */
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { relocateDir } = require("./win-safe-fs");
const {
  parseEnvFile,
  mergeSecretsIntoDotenv,
  readLicenseHmacFromDotenv,
} = require("./merge-desktop-build-env");

const desktopRoot = path.join(__dirname, "..");
const repoRoot = path.join(desktopRoot, "..");
// En este script, `repoRoot` apunta a `apps/`, por eso el backend está en `apps/api`.
const apiRoot = path.join(repoRoot, "api");
const embedDir = path.join(desktopRoot, "embed-api");

const apiDist = path.join(apiRoot, "dist");
/** Preferido: carpeta prisma/desktop (SQLite solo escritorio, doc en apps/api/prisma/README.md). */
const apiPrismaDesktop = path.join(apiRoot, "prisma", "desktop");
const apiPrismaRoot = path.join(apiRoot, "prisma");
const apiPackage = path.join(apiRoot, "package.json");
const apiEnvDesktop = path.join(apiRoot, ".env.desktop");
const apiSeedTs = path.join(apiRoot, "prisma", "seed.ts");
const apiMarginCleanBlocks = path.join(
  apiRoot,
  "src",
  "modules",
  "quotes",
  "margin-hierarchy",
  "margin-hierarchy.clean-blocks.ts",
);
const apiMarginConstants = path.join(
  apiRoot,
  "src",
  "modules",
  "quotes",
  "margin-hierarchy",
  "margin-hierarchy.constants.ts",
);

function logObj(label, value) {
  console.log(`[prepare-embedded-backend] ${label}:`, value);
}

function runOrFail(cmd, args, opts) {
  console.log(`[prepare-embedded-backend] Ejecutando: ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, opts);
  if (result.error) {
    console.error(`[prepare-embedded-backend] Error spawn:`, result.error);
  }
  if (result.status !== 0) {
    console.error(`[prepare-embedded-backend] Exit code:`, result.status);
    if (result.stdout) console.error(`[prepare-embedded-backend] stdout:\n${String(result.stdout)}`);
    if (result.stderr) console.error(`[prepare-embedded-backend] stderr:\n${String(result.stderr)}`);
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
  return result;
}

function isSqliteSchema(schemaPath) {
  if (!fs.existsSync(schemaPath)) return false;
  const t = fs.readFileSync(schemaPath, "utf8");
  return /datasource\s+db\s*\{[^}]*provider\s*=\s*"sqlite"/s.test(t);
}

function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      const s = path.join(src, name);
      const d = path.join(dst, name);
      if (name === "node_modules") continue;
      copyRecursive(s, d);
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

console.log("------------------------------------------------------------");
console.log("[prepare-embedded-backend] Inicio");
logObj("cwd", process.cwd());
logObj("desktopRoot", desktopRoot);
logObj("repoRoot", repoRoot);
logObj("apiRoot (origen)", apiRoot);
logObj("apiDist", apiDist);
logObj("apiPrismaDesktop (preferido)", apiPrismaDesktop);
logObj("apiPrismaRoot (fallback)", apiPrismaRoot);
logObj("embedDir (salida)", embedDir);

try {
  if (!fs.existsSync(apiDist) || !fs.existsSync(path.join(apiDist, "main.js"))) {
    throw new Error(
      `No existe backend compilado: expected ${path.join(apiDist, "main.js")}. Ejecuta: npm run build --workspace=api`
    );
  }
  const rootSchemaPath = path.join(apiPrismaRoot, "schema.prisma");
  let prismaEmbedSource;
  if (fs.existsSync(apiPrismaDesktop)) {
    prismaEmbedSource = apiPrismaDesktop;
  } else if (isSqliteSchema(rootSchemaPath)) {
    prismaEmbedSource = apiPrismaRoot;
    console.log(
      "[prepare-embedded-backend] prisma/desktop/ ausente; usando apps/api/prisma/ (schema SQLite en raíz).",
    );
  } else {
    throw new Error(
      `No existe prisma/desktop en ${apiPrismaDesktop} y prisma/schema.prisma no es SQLite en ${rootSchemaPath}. ` +
        `Cree apps/api/prisma/desktop con schema + migrations (ver apps/api/prisma/README.md) o use esquema SQLite en prisma/schema.prisma.`,
    );
  }
  logObj("prisma origen (embed)", prismaEmbedSource);
  if (!fs.existsSync(apiPackage)) {
    throw new Error(`No existe package.json del backend en: ${apiPackage}`);
  }
  if (!fs.existsSync(apiEnvDesktop)) {
    throw new Error(`No existe el env de portable en: ${apiEnvDesktop}`);
  }

  if (fs.existsSync(embedDir)) {
    console.log("[prepare-embedded-backend] Moviendo embed-api/ anterior a .__stale__…");
    if (!relocateDir(embedDir)) {
      throw new Error(
        "No se pudo mover embed-api (¿antivirus o carpeta abierta?). Cierre procesos y reintente.",
      );
    }
  }
  console.log("[prepare-embedded-backend] Creando embed-api/ …");
  fs.mkdirSync(embedDir, { recursive: true });

  console.log("[prepare-embedded-backend] Copiando package.json, prisma (origen) → prisma/, dist/ a embed-api/ …");
  fs.copyFileSync(apiPackage, path.join(embedDir, "package.json"));
  copyRecursive(prismaEmbedSource, path.join(embedDir, "prisma"));
  copyRecursive(apiDist, path.join(embedDir, "dist"));
  // seed.ts importa ../src/... — necesario para `prisma db seed` en arranque empaquetado
  if (!fs.existsSync(apiSeedTs)) {
    throw new Error(`No existe seed: ${apiSeedTs}`);
  }
  fs.copyFileSync(apiSeedTs, path.join(embedDir, "prisma", "seed.ts"));
  const marginDst = path.join(embedDir, "src", "modules", "quotes", "margin-hierarchy");
  fs.mkdirSync(marginDst, { recursive: true });
  fs.copyFileSync(apiMarginCleanBlocks, path.join(marginDst, "margin-hierarchy.clean-blocks.ts"));
  fs.copyFileSync(apiMarginConstants, path.join(marginDst, "margin-hierarchy.constants.ts"));
  console.log("[prepare-embedded-backend] Copiando env portable (.env.desktop) -> embed-api/.env …");
  const embedEnvPath = path.join(embedDir, ".env");
  fs.copyFileSync(apiEnvDesktop, embedEnvPath);

  const exampleSecretsPath = path.join(desktopRoot, "desktop-build.env.example");
  const buildSecretsPath = path.join(desktopRoot, "desktop-build.env");
  if (!fs.existsSync(buildSecretsPath) && fs.existsSync(exampleSecretsPath)) {
    fs.copyFileSync(exampleSecretsPath, buildSecretsPath);
    console.log(
      "[prepare-embedded-backend] Creado desktop-build.env desde desktop-build.env.example (revise LICENSE_HMAC_SECRET para producción).",
    );
  }
  if (fs.existsSync(buildSecretsPath)) {
    const sec = parseEnvFile(fs.readFileSync(buildSecretsPath, "utf8"));
    mergeSecretsIntoDotenv(embedEnvPath, sec);
    console.log("[prepare-embedded-backend] Claves fusionadas desde desktop-build.env → embed-api/.env");
  }

  const hmacSecret = readLicenseHmacFromDotenv(embedEnvPath);
  if (!hmacSecret || hmacSecret.length < 16) {
    throw new Error(
      "LICENSE_HMAC_SECRET inválido o ausente en embed-api/.env. " +
        "Edite api/.env.desktop o cree apps/desktop/desktop-build.env con LICENSE_HMAC_SECRET=(secreto largo).",
    );
  }
  if (
    /MISMO_SECRETO_QUE_BUILD|CHANGE-ME-IN-CI|PVQ-DESKTOP-LICENSE-CHANGE-ME/i.test(hmacSecret)
  ) {
    if (process.env.DESKTOP_BUILD_ALLOW_PLACEHOLDER_LICENSE_SECRET === "1") {
      console.warn(
        "[prepare-embedded-backend] ADVERTENCIA: LICENSE_HMAC_SECRET es placeholder (solo pruebas).",
      );
    } else {
      throw new Error(
        "LICENSE_HMAC_SECRET sigue siendo placeholder. Defina un secreto real en api/.env.desktop o desktop-build.env " +
          "(o DESKTOP_BUILD_ALLOW_PLACEHOLDER_LICENSE_SECRET=1 solo para desarrollo).",
      );
    }
  }

  // Copia espejo SIN punto inicial: electron-builder suele NO incluir `.env` en extraResources;
  // Electron lee este archivo; Nest carga .env y env.embedded (ver api app.module).
  const envEmbeddedMirror = path.join(embedDir, "env.embedded");
  fs.copyFileSync(embedEnvPath, envEmbeddedMirror);
  console.log("[prepare-embedded-backend] Escrito env.embedded (mismo contenido que .env, siempre empaquetado).");

  const tsconfigEmbed = {
    compilerOptions: {
      module: "CommonJS",
      moduleResolution: "node",
      esModuleInterop: true,
      strict: false,
      skipLibCheck: true,
      target: "ES2021",
    },
    include: ["prisma/**/*.ts", "src/**/*.ts"],
  };
  fs.writeFileSync(path.join(embedDir, "tsconfig.json"), JSON.stringify(tsconfigEmbed, null, 2));

  console.log("[prepare-embedded-backend] Ejecutando npm install en embed-api/ …");
  runOrFail("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: embedDir,
    stdio: "inherit",
    shell: true,
  });

  console.log("[prepare-embedded-backend] Ejecutando prisma generate en embed-api/ …");
  runOrFail("npx", ["prisma", "generate"], {
    cwd: embedDir,
    stdio: "inherit",
    shell: true,
  });

  const mainJsPath = path.join(embedDir, "dist", "main.js");
  console.log("[prepare-embedded-backend] Verificación final:");
  logObj("dist/main.js", mainJsPath);
  logObj("existe dist/main.js?", fs.existsSync(mainJsPath));
  if (!fs.existsSync(mainJsPath)) {
    throw new Error(`No se encontró: ${mainJsPath}`);
  }

  console.log("[prepare-embedded-backend] Backend embebido listo en embed-api/");
  console.log("------------------------------------------------------------");
} catch (err) {
  console.error("------------------------------------------------------------");
  console.error("[prepare-embedded-backend] ERROR:", err && err.stack ? err.stack : err);
  console.error("------------------------------------------------------------");
  process.exit(1);
}
