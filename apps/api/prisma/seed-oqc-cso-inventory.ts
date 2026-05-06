import "dotenv/config";

/**
 * Crea en BD los 14 paneles OQC (un ítem por número de serie) para el proyecto CSO.
 * Idempotente: omite seriales que ya existan con destino PROJECT en ese proyecto.
 *
 * CLI (desde apps/api): `npm run seed:oqc-cso-inventory`
 */
import { PrismaClient } from "@prisma/client";
import { OQC_PRESET_EGE2026_2356_META, OQC_PRESET_EGE2026_2356_PANELS } from "../src/modules/inventory/oqc-preset-ege2026-2356";
import { buildOqcInventoryUncheckedCreateInput } from "../src/modules/inventory/oqc-serial-item-builder";

const prisma = new PrismaClient();

function scoreOqcCatalogProductName(name: string): number {
  const n = name.toLowerCase();
  let s = 0;
  if (/ege[- ]?720|720w|132n|\bgm12\b/i.test(n)) s += 14;
  if (/\b720\b/.test(n)) s += 5;
  if (/ecogreen|eco\s*green/i.test(n)) s += 3;
  if (/\b630\b/.test(n) && !/\b720\b/.test(n) && !/720w/i.test(n)) s -= 6;
  return s;
}

function productNameSuggestsOqc720W(name: string): boolean {
  return /\b720\b|720w|132n|\bgm12\b|ege[- ]?720/i.test(name);
}

async function resolveProductId(): Promise<string | null> {
  const candidates = await prisma.product.findMany({
    where: {
      commercialStatus: "ACTIVO",
      OR: [
        { name: { contains: "Ecogreen" } },
        { name: { contains: "ECOGREEN" } },
        { name: { contains: "Eco Green" } },
        { name: { contains: "EGE" } },
      ],
    },
    select: { id: true, name: true },
    take: 80,
  });
  if (!candidates.length) return null;
  const prefer720 = candidates.filter((p) => productNameSuggestsOqc720W(p.name));
  const pool = prefer720.length ? prefer720 : candidates;
  const scored = [...pool].sort((a, b) => scoreOqcCatalogProductName(b.name) - scoreOqcCatalogProductName(a.name));
  return scored[0]?.id ?? null;
}

async function main() {
  let project = await prisma.project.findUnique({ where: { code: "CSO" } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        code: "CSO",
        name: "PARQUE FOTOVOLTAICO CERRO SOMBRERO",
        client: "Mandante / SPV proyecto FV (referencia CSO)",
        location: "Cerro Sombrero, Magallanes, Chile",
        status: "IN_PROGRESS",
        progress: 0,
        description: "Sembrado OQC inventario (Eco Green orden 2356).",
      },
    });
    console.log(`  Proyecto CSO creado: id=${project.id}`);
  } else {
    console.log(`  Proyecto CSO existente: id=${project.id}`);
  }

  const productId = await resolveProductId();
  console.log(`  Producto catálogo vinculado: ${productId ?? "(ninguno)"}`);

  const reportRef = OQC_PRESET_EGE2026_2356_META.reportRef;
  const sourceFileHint = OQC_PRESET_EGE2026_2356_META.sourceFileHint;
  const preset = "EGE2026_OQC_2356" as const;

  let created = 0;
  let skipped = 0;

  for (const row of OQC_PRESET_EGE2026_2356_PANELS) {
    const serial = row.serialNumber.trim();
    const existing = await prisma.inventoryItem.findFirst({
      where: { projectId: project.id, sku: serial, destinationKind: "PROJECT" },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    const data = buildOqcInventoryUncheckedCreateInput({
      row,
      projectId: project.id,
      projectCode: project.code,
      productId,
      reportRef,
      sourceFileHint,
      preset,
    });
    await prisma.inventoryItem.create({ data });
    created += 1;
  }

  const total = await prisma.inventoryItem.count();
  console.log(`  OQC CSO: creadas ${created}, omitidas (ya existían) ${skipped}. InventoryItem total en BD: ${total}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
