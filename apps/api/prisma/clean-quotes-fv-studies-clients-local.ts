import "dotenv/config";

/**
 * Limpieza QUIRÚRGICA local: elimina cotizaciones, estudios FV y clientes.
 * NO borra: User, Role, Product, Category, Brand, Supplier, QuoteTemplate, QuoteAddOn,
 * CompanyProfile, ActivationCode, Installation, conversaciones/chat, etc.
 *
 * Orden de borrado según schema.prisma (SQLite): primero hijos de QuoteVersion, luego
 * QuoteVersion, MarginTemplateSnapshot que referencian cotización, Quote, FvStudy (cascada
 * Prisma a FvStudyMonth / ImplantationDesign / ImplantationPanelPlacement), Client.
 *
 * Uso (PowerShell, desde apps/api, con SQLite local):
 *   $env:PVQ_ALLOW_CLEAN_TEST_DATA="1"; npx ts-node prisma/clean-quotes-fv-studies-clients-local.ts
 *
 * Simulación (solo conteos, no borra):
 *   $env:PVQ_ALLOW_CLEAN_TEST_DATA="1"; npx ts-node prisma/clean-quotes-fv-studies-clients-local.ts --dry-run
 *
 * Revertir: copia previa del archivo .sqlite de userData o del dev (no hay undo en script).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

function assertSafeToRun(): void {
  const dbUrl = (process.env.DATABASE_URL || "").trim();
  if (!dbUrl.startsWith("file:")) {
    throw new Error(
      "[clean-quotes-fv] DATABASE_URL debe ser SQLite (prefijo file:). Abortado.",
    );
  }
  if (process.env.PVQ_ALLOW_CLEAN_TEST_DATA !== "1") {
    throw new Error(
      "[clean-quotes-fv] Defina PVQ_ALLOW_CLEAN_TEST_DATA=1 para ejecutar (solo entornos controlados).",
    );
  }
}

async function main(): Promise<void> {
  assertSafeToRun();

  const allQuoteIds = (await prisma.quote.findMany({ select: { id: true } })).map((q) => q.id);
  const versionRows =
    allQuoteIds.length === 0
      ? []
      : await prisma.quoteVersion.findMany({
          where: { quoteId: { in: allQuoteIds } },
          select: { id: true, quoteId: true },
        });
  const versionIds = versionRows.map((v) => v.id);

  const fvCount = await prisma.fvStudy.count();
  const clientCount = await prisma.client.count();

  const marginSnapCount =
    allQuoteIds.length === 0 && versionIds.length === 0
      ? 0
      : await prisma.marginTemplateSnapshot.count({
          where: {
            OR: [
              ...(allQuoteIds.length ? [{ sourceQuoteId: { in: allQuoteIds } }] : []),
              ...(versionIds.length ? [{ sourceQuoteVersionId: { in: versionIds } }] : []),
            ],
          },
        });

  console.log("\n=== clean-quotes-fv-studies-clients-local ===");
  console.log("DRY_RUN:", DRY_RUN);
  console.log("DATABASE_URL (prefijo):", (process.env.DATABASE_URL || "").slice(0, 24) + "…");
  console.log("\nConteos actuales (antes):");
  console.log("  Client:", clientCount);
  console.log("  FvStudy:", fvCount);
  console.log("  Quote:", allQuoteIds.length);
  console.log("  QuoteVersion:", versionIds.length);
  console.log(
    "  MarginTemplateSnapshot (sourceQuoteId o sourceQuoteVersionId ligados a cotizaciones a borrar):",
    marginSnapCount,
  );

  const sug =
    versionIds.length === 0
      ? 0
      : await prisma.quoteAddOnSuggestion.count({
          where: { quoteVersionId: { in: versionIds } },
        });
  const items =
    versionIds.length === 0
      ? 0
      : await prisma.quoteItem.count({
          where: { quoteVersionId: { in: versionIds } },
        });
  const mainIds =
    versionIds.length === 0
      ? []
      : await prisma.quoteMainItem.findMany({
          where: { quoteVersionId: { in: versionIds } },
          select: { id: true },
        });
  const mainItemIds = mainIds.map((m) => m.id);
  const lines =
    mainItemIds.length === 0
      ? 0
      : await prisma.quoteItemLine.count({
          where: { quoteMainItemId: { in: mainItemIds } },
        });
  const inputs =
    versionIds.length === 0
      ? 0
      : await prisma.quoteAddOnInput.count({
          where: { quoteVersionId: { in: versionIds } },
        });
  const calcs =
    allQuoteIds.length === 0 && versionIds.length === 0
      ? 0
      : await prisma.quoteFvCalculation.count({
          where: {
            OR: [
              ...(allQuoteIds.length ? [{ quoteId: { in: allQuoteIds } }] : []),
              ...(versionIds.length ? [{ quoteVersionId: { in: versionIds } }] : []),
            ],
          },
        });

  console.log("\nDetalle árbol Quote (versiones detectadas):");
  console.log("  QuoteAddOnSuggestion:", sug);
  console.log("  QuoteItem:", items);
  console.log("  QuoteItemLine:", lines);
  console.log("  QuoteMainItem:", mainItemIds.length);
  console.log("  QuoteAddOnInput:", inputs);
  console.log("  QuoteFvCalculation:", calcs);

  console.log(
    "\nModelos FvStudy hijos (se borran vía deleteMany FvStudy si cascada OK; si falla, revisar FK):",
  );
  console.log("  FvStudyMonth, ImplantationDesign, ImplantationPanelPlacement → ligados a FvStudy");

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] No se modificó la base de datos.\n");
    await prisma.$disconnect();
    return;
  }

  const deleted: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    deleted.quoteAddOnSuggestion = (
      await tx.quoteAddOnSuggestion.deleteMany({
        where: { quoteVersionId: { in: versionIds } },
      })
    ).count;

    deleted.quoteItem = (
      await tx.quoteItem.deleteMany({
        where: { quoteVersionId: { in: versionIds } },
      })
    ).count;

    deleted.quoteItemLine = (
      await tx.quoteItemLine.deleteMany({
        where: { quoteMainItemId: { in: mainItemIds } },
      })
    ).count;

    deleted.quoteMainItem = (
      await tx.quoteMainItem.deleteMany({
        where: { quoteVersionId: { in: versionIds } },
      })
    ).count;

    deleted.quoteAddOnInput = (
      await tx.quoteAddOnInput.deleteMany({
        where: { quoteVersionId: { in: versionIds } },
      })
    ).count;

    deleted.quoteFvCalculation =
      allQuoteIds.length === 0 && versionIds.length === 0
        ? 0
        : (
            await tx.quoteFvCalculation.deleteMany({
              where: {
                OR: [
                  ...(allQuoteIds.length ? [{ quoteId: { in: allQuoteIds } }] : []),
                  ...(versionIds.length ? [{ quoteVersionId: { in: versionIds } }] : []),
                ],
              },
            })
          ).count;

    deleted.quoteVersion = (
      await tx.quoteVersion.deleteMany({
        where: { quoteId: { in: allQuoteIds } },
      })
    ).count;

    deleted.marginTemplateSnapshot =
      allQuoteIds.length === 0 && versionIds.length === 0
        ? 0
        : (
            await tx.marginTemplateSnapshot.deleteMany({
              where: {
                OR: [
                  ...(allQuoteIds.length ? [{ sourceQuoteId: { in: allQuoteIds } }] : []),
                  ...(versionIds.length ? [{ sourceQuoteVersionId: { in: versionIds } }] : []),
                ],
              },
            })
          ).count;

    deleted.quote = (await tx.quote.deleteMany({})).count;

    // FvStudy: en schema, FvStudyMonth e ImplantationDesign tienen onDelete: Cascade hacia FvStudy
    deleted.fvStudy = (await tx.fvStudy.deleteMany({})).count;

    deleted.client = (await tx.client.deleteMany({})).count;
  });

  console.log("\n=== Registros eliminados (deleteMany.count) ===");
  for (const [k, v] of Object.entries(deleted)) {
    console.log(`  ${k}: ${v}`);
  }

  const cClient = await prisma.client.count();
  const cFv = await prisma.fvStudy.count();
  const cQuote = await prisma.quote.count();
  const cVer = await prisma.quoteVersion.count();

  console.log("\n=== Conteos después (deben ser 0 en Client, FvStudy, Quote, QuoteVersion) ===");
  console.log("  Client:", cClient);
  console.log("  FvStudy:", cFv);
  console.log("  Quote:", cQuote);
  console.log("  QuoteVersion:", cVer);

  console.log("\nListo. Usuarios, roles, productos, plantillas, chat y perfil empresa no se tocaron.\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
