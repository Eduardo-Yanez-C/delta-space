/**
 * Carga el organigrama «Marzo 2026» (mismo dataset que Sofware de Mejora) en esta base de datos.
 * Ejecutar desde apps/api con DATABASE_URL en .env:
 *   npm run seed:organigrama-marzo-2026
 *
 * Borra conexiones libres y nodos existentes; luego inserta ORG_SPECS.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { PrismaClient } = require("@prisma/client");
const { ORG_SPECS } = require("./data/organigrama-marzo-2026-nodes.cjs");

const prisma = new PrismaClient();

async function main() {
  await prisma.organizationCustomEdge.deleteMany({});
  await prisma.organizationNode.updateMany({ data: { linkToId: null } });
  await prisma.organizationNode.deleteMany({});

  const idByKey = {};

  for (const row of ORG_SPECS) {
    const parentId = row.parentKey ? idByKey[row.parentKey] : null;
    if (row.parentKey && !parentId) {
      throw new Error(`Parent no resuelto para ${row.key} → ${row.parentKey}`);
    }
    const created = await prisma.organizationNode.create({
      data: {
        name: row.name,
        role: row.role,
        category: row.category ?? null,
        parentId,
        order: row.order ?? 0,
        active: true,
      },
    });
    idByKey[row.key] = created.id;
  }

  for (const row of ORG_SPECS) {
    if (!row.linkToKey) continue;
    const id = idByKey[row.key];
    const linkToId = idByKey[row.linkToKey];
    if (!id || !linkToId) continue;
    await prisma.organizationNode.update({
      where: { id },
      data: { linkToId },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        nodes: ORG_SPECS.length,
        note: "Mismo origen que Sofware de Mejora (PDF Organigrama empresa Marzo 2026).",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
