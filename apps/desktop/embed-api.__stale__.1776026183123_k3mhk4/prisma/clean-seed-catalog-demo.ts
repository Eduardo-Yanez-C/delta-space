/**
 * Elimina solo el catálogo demo insertado por prisma/seed.ts (seedCatalog),
 * sin borrar usuarios, roles, cotizaciones, estudios FV, clientes, etc.
 *
 * Criterios: códigos internos de productos demo, RUTs/emails de proveedores demo,
 * marcas/modelos creados únicamente por ese seed (solo se borran si ya no tienen referencias).
 *
 * Uso (misma DATABASE_URL que la app, p. ej. portable):
 *   cd apps/api
 *   npx ts-node prisma/clean-seed-catalog-demo.ts
 *
 * Simulación (no escribe en BD):
 *   npx ts-node prisma/clean-seed-catalog-demo.ts --dry-run
 *
 * Si un producto demo está referenciado por una cotización (QuoteItem / QuoteItemLine),
 * NO se elimina y se lista en el informe.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

/** internalCode exactos de los 15 productos creados en seedCatalog (seed.ts). */
const DEMO_PRODUCT_INTERNAL_CODES = [
  "PV-LG-430",
  "PV-LG-550",
  "PV-LG-430-ALT",
  "INV-HW-100K",
  "INV-FRO-3.6",
  "INV-FRO-10",
  "INV-HW-LUNA5",
  "INV-BYD-HYB",
  "INV-VIC-5K",
  "BAT-BYD-5.1",
  "BAT-BYD-11",
  "EST-K2-DDOME",
  "EST-K2-TOPFIX",
  "SERV-ING",
  "SERV-MO",
] as const;

/** Proveedores nacionales demo: RUT tal como en seed.ts */
const DEMO_SUPPLIER_TAX_IDS = ["76.200.100-1", "77.300.200-2", "78.400.300-3"] as const;

/** Proveedores internacionales demo: email único en seed (taxId null) */
const DEMO_SUPPLIER_INTL = [
  { email: "export@longi.com", name: "Longi Solar (OEM)" },
  { email: "solar@huawei.com", name: "Huawei Digital Power" },
  { email: "storage@byd.com", name: "BYD Energy Storage" },
] as const;

/** Marcas creadas en seed (nombre exacto). */
const DEMO_BRAND_NAMES = ["Longi", "Huawei", "Fronius", "BYD", "Victron", "K2 Systems"] as const;

/** Modelos (marca + nombre) tal como en seed.ts */
const DEMO_MODELS: { brandName: string; modelName: string }[] = [
  { brandName: "Longi", modelName: "Hi-MO 6 430W" },
  { brandName: "Longi", modelName: "Hi-MO 5 550W" },
  { brandName: "Huawei", modelName: "SUN2000-100KTL-M1" },
  { brandName: "Huawei", modelName: "LUNA2000-5-S0" },
  { brandName: "Fronius", modelName: "Primo 3.6-1" },
  { brandName: "Fronius", modelName: "Symo 10.0-3" },
  { brandName: "BYD", modelName: "Battery-Box HVS 5.1" },
  { brandName: "BYD", modelName: "Battery-Box HVM 11.0" },
  { brandName: "Victron", modelName: "MultiPlus-II 48/5000" },
  { brandName: "K2 Systems", modelName: "D-Dome" },
  { brandName: "K2 Systems", modelName: "TopFix" },
];

async function productRefCounts(productId: string): Promise<number> {
  const [qi, qil] = await Promise.all([
    prisma.quoteItem.count({ where: { productId } }),
    prisma.quoteItemLine.count({ where: { productId } }),
  ]);
  return qi + qil;
}

async function brandRefCounts(brandId: number): Promise<number> {
  const [qi, qil] = await Promise.all([
    prisma.quoteItem.count({ where: { brandId } }),
    prisma.quoteItemLine.count({ where: { brandId } }),
  ]);
  return qi + qil;
}

async function modelRefCounts(modelId: number): Promise<number> {
  const [qi, qil] = await Promise.all([
    prisma.quoteItem.count({ where: { modelId } }),
    prisma.quoteItemLine.count({ where: { modelId } }),
  ]);
  return qi + qil;
}

/** En dry-run, los productos aún existen; se excluyen de conteos para simular el orden real (productos → proveedores → modelos → marcas). */
function pendingProductExclude(
  pendingIds: string[],
): { id: { notIn: string[] } } | Record<string, never> {
  if (!DRY_RUN || pendingIds.length === 0) return {};
  return { id: { notIn: pendingIds } };
}

function pendingProductSupplierExclude(
  pendingIds: string[],
): { productId: { notIn: string[] } } | Record<string, never> {
  if (!DRY_RUN || pendingIds.length === 0) return {};
  return { productId: { notIn: pendingIds } };
}

async function main() {
  console.log(DRY_RUN ? "[DRY-RUN] No se aplicarán cambios.\n" : "[EJECUCIÓN] Se eliminarán datos demo seguros.\n");

  const demoProducts = await prisma.product.findMany({
    where: { internalCode: { in: [...DEMO_PRODUCT_INTERNAL_CODES] } },
    select: { id: true, internalCode: true, name: true },
  });

  const skippedProducts: { internalCode: string | null; name: string; reason: string }[] = [];
  const toDeleteProductIds: string[] = [];

  for (const p of demoProducts) {
    const refs = await productRefCounts(p.id);
    if (refs > 0) {
      skippedProducts.push({
        internalCode: p.internalCode,
        name: p.name,
        reason: `referenciado en ${refs} ítem(s) de cotización (QuoteItem/Line)`,
      });
    } else {
      toDeleteProductIds.push(p.id);
    }
  }

  const missingCodes = DEMO_PRODUCT_INTERNAL_CODES.filter(
    (code) => !demoProducts.some((p) => p.internalCode === code),
  );

  console.log("— Productos demo encontrados por internalCode:", demoProducts.length);
  if (missingCodes.length > 0) {
    console.log("  (No existen en BD, omitidos):", missingCodes.join(", "));
  }
  console.log("  A eliminar (sin refs en cotizaciones):", toDeleteProductIds.length);
  if (skippedProducts.length > 0) {
    console.log("  NO eliminados (tienen uso en cotizaciones):");
    skippedProducts.forEach((s) =>
      console.log(`    - ${s.internalCode ?? "?"} | ${s.name} → ${s.reason}`),
    );
  }

  if (!DRY_RUN && toDeleteProductIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.productPrice.deleteMany({ where: { productId: { in: toDeleteProductIds } } });
      await tx.productSupplier.deleteMany({ where: { productId: { in: toDeleteProductIds } } });
      await tx.product.deleteMany({ where: { id: { in: toDeleteProductIds } } });
    });
    console.log("  OK: precios, relaciones producto–proveedor y productos demo eliminados.");
  }

  const demoSupplierIds = new Set<string>();

  const byTax = await prisma.supplier.findMany({
    where: { taxId: { in: [...DEMO_SUPPLIER_TAX_IDS] } },
    select: { id: true, name: true, taxId: true },
  });
  byTax.forEach((s) => demoSupplierIds.add(s.id));

  for (const row of DEMO_SUPPLIER_INTL) {
    const s = await prisma.supplier.findFirst({
      where: { email: row.email, name: row.name },
      select: { id: true },
    });
    if (s) demoSupplierIds.add(s.id);
  }

  console.log("\n— Proveedores demo candidatos:", demoSupplierIds.size);

  const skippedSuppliers: string[] = [];
  const toDeleteSupplierIds: string[] = [];

  for (const sid of demoSupplierIds) {
    const [primary, ps, pp] = await Promise.all([
      prisma.product.count({
        where: { primarySupplierId: sid, ...pendingProductExclude(toDeleteProductIds) },
      }),
      prisma.productSupplier.count({
        where: { supplierId: sid, ...pendingProductSupplierExclude(toDeleteProductIds) },
      }),
      prisma.productPrice.count({
        where: { supplierId: sid, ...pendingProductSupplierExclude(toDeleteProductIds) },
      }),
    ]);
    if (primary + ps + pp > 0) {
      skippedSuppliers.push(
        `${sid}: aún en uso (productos primarios/relación/precios: ${primary}/${ps}/${pp})`,
      );
    } else {
      toDeleteSupplierIds.push(sid);
    }
  }

  if (skippedSuppliers.length > 0) {
    console.log("  NO eliminados:");
    skippedSuppliers.forEach((l) => console.log("    -", l));
  }
  console.log("  A eliminar:", toDeleteSupplierIds.length);

  if (!DRY_RUN && toDeleteSupplierIds.length > 0) {
    await prisma.supplier.deleteMany({ where: { id: { in: toDeleteSupplierIds } } });
    console.log("  OK: proveedores demo eliminados.");
  }

  console.log("\n— Modelos demo (marca + nombre):");

  for (const { brandName, modelName } of DEMO_MODELS) {
    const brand = await prisma.brand.findUnique({ where: { name: brandName }, select: { id: true } });
    if (!brand) continue;
    const m = await prisma.productModel.findUnique({
      where: { brandId_name: { brandId: brand.id, name: modelName } },
      select: { id: true },
    });
    if (!m) continue;

    const [pCount, refs] = await Promise.all([
      prisma.product.count({
        where: { modelId: m.id, ...pendingProductExclude(toDeleteProductIds) },
      }),
      modelRefCounts(m.id),
    ]);
    if (pCount + refs > 0) {
      console.log(`  SKIP ${brandName} / ${modelName} (productos:${pCount}, refs cotiz.:${refs})`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [DRY-RUN] eliminaría ${brandName} / ${modelName}`);
    } else {
      await prisma.productModel.delete({ where: { id: m.id } });
      console.log(`  OK ${brandName} / ${modelName}`);
    }
  }

  console.log("\n— Marcas demo (nombre exacto del seed):");

  for (const name of DEMO_BRAND_NAMES) {
    const brand = await prisma.brand.findUnique({
      where: { name },
      select: { id: true },
    });
    if (!brand) {
      console.log(`  (no existe) ${name}`);
      continue;
    }

    const bRefs = await brandRefCounts(brand.id);

    let pCount: number;
    let mCount: number;

    if (DRY_RUN && toDeleteProductIds.length > 0) {
      pCount = await prisma.product.count({
        where: { brandId: brand.id, ...pendingProductExclude(toDeleteProductIds) },
      });
      const models = await prisma.productModel.findMany({
        where: { brandId: brand.id },
        select: { id: true },
      });
      let blockingModels = 0;
      for (const mod of models) {
        const pc = await prisma.product.count({
          where: { modelId: mod.id, ...pendingProductExclude(toDeleteProductIds) },
        });
        const rc = await modelRefCounts(mod.id);
        if (pc + rc > 0) blockingModels += 1;
      }
      mCount = blockingModels;
    } else {
      [pCount, mCount] = await Promise.all([
        prisma.product.count({ where: { brandId: brand.id } }),
        prisma.productModel.count({ where: { brandId: brand.id } }),
      ]);
    }

    if (pCount + mCount + bRefs > 0) {
      const modeloLabel = DRY_RUN && toDeleteProductIds.length > 0 ? "modelos (bloquean)" : "modelos";
      console.log(`  SKIP ${name} (productos:${pCount}, ${modeloLabel}:${mCount}, refs cotiz. marca:${bRefs})`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [DRY-RUN] eliminaría marca ${name}`);
    } else {
      await prisma.brand.delete({ where: { id: brand.id } });
      console.log(`  OK ${name}`);
    }
  }

  console.log(
    "\nHecho. Usuarios, roles, instalaciones, cotizaciones (salvo vínculos a productos omitidos), categorías maestras y demás datos no demo no se modifican.",
  );
  if (DRY_RUN) {
    console.log("\nEjecute sin --dry-run para aplicar los borrados.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
