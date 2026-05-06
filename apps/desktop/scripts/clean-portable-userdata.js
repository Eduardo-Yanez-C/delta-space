/**
 * Elimina solo datos de negocio (clientes, estudios FV, cotizaciones y dependencias)
 * de una base SQLite embebida del escritorio/portable.
 *
 * NO toca: usuarios, roles, catálogos, plantillas, productos, etc.
 *
 * La base real del portable es: app.getPath('userData')/database.sqlite. Con package.json name="desktop"
 * suele ser: %AppData%\\Roaming\\desktop\\database.sqlite (NO confundir con productName de electron-builder).
 *
 * Limpieza COMPLETA (incl. productos/proveedores): usar apps/api → npm run clean:full-reset con:
 *   $env:PORTABLE_DATABASE_PATH="$env:APPDATA\\desktop\\database.sqlite"
 *
 * Uso de ESTE script (solo operativo, sin catálogo), app CERRADA:
 *   node ../desktop/scripts/clean-portable-userdata.js
 *
 * O pasar ruta absoluta al .sqlite:
 *   node ../desktop/scripts/clean-portable-userdata.js "C:\...\database.sqlite"
 */
const path = require("path");
const fs = require("fs");
const os = require("os");

// Cargar Prisma desde apps/api
const apiRoot = path.join(__dirname, "..", "..", "api");
const { PrismaClient } = require(path.join(apiRoot, "node_modules", "@prisma", "client"));

function toFileUrl(absPath) {
  const norm = absPath.replace(/\\/g, "/");
  return "file:" + (norm.startsWith("/") ? norm : "/" + norm);
}

function defaultPortableDbPath() {
  // Debe coincidir con main.js: path.join(app.getPath("userData"), "database.sqlite")
  // Electron userData = Roaming/<name> donde <name> viene del "name" en package.json del desktop ("desktop").
  if (process.platform === "win32") {
    return path.join(os.homedir(), "AppData", "Roaming", "desktop", "database.sqlite");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "desktop", "database.sqlite");
  }
  return path.join(os.homedir(), ".config", "desktop", "database.sqlite");
}

async function main() {
  const argPath = process.argv[2];
  const sqlitePath = argPath ? path.resolve(argPath) : defaultPortableDbPath();

  if (!fs.existsSync(sqlitePath)) {
    console.error("[clean-portable-userdata] No existe la base:", sqlitePath);
    process.exit(1);
  }

  const url = process.env.DATABASE_URL || toFileUrl(sqlitePath);
  console.log("[clean-portable-userdata] DATABASE_URL =", url);

  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    const countsBefore = {
      clients: await prisma.client.count(),
      fvStudies: await prisma.fvStudy.count(),
      quotes: await prisma.quote.count(),
    };
    console.log("[clean-portable-userdata] Antes:", countsBefore);

    await prisma.$transaction(async (tx) => {
      await tx.quoteAddOnSuggestion.deleteMany();
      await tx.quoteAddOnInput.deleteMany();
      await tx.quoteItem.deleteMany();
      await tx.quoteFvCalculation.deleteMany();
      await tx.quoteMainItem.deleteMany();
      await tx.quoteVersion.deleteMany();
      await tx.quote.deleteMany();
      await tx.fvStudy.deleteMany();
      await tx.client.deleteMany();
    });

    const countsAfter = {
      clients: await prisma.client.count(),
      fvStudies: await prisma.fvStudy.count(),
      quotes: await prisma.quote.count(),
    };
    console.log("[clean-portable-userdata] Después:", countsAfter);
    console.log("[clean-portable-userdata] OK");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[clean-portable-userdata] Error:", e);
  process.exit(1);
});
