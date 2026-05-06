/**
 * Auditoría de integridad referencial (PostgreSQL) vía LEFT JOIN.
 * Sale con código 1 si algún conteo > 0.
 *
 * Uso: desde apps/api con DATABASE_URL apuntando a Postgres:
 *   npm run integrity:db
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient, Prisma } from "@prisma/client";

type Check = { name: string; sql: Prisma.Sql };

const checks: Check[] = [
  {
    name: "quote_missing_client",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "Quote" q
      LEFT JOIN "Client" c ON c.id = q."clientId"
      WHERE c.id IS NULL`,
  },
  {
    name: "quote_missing_owner",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "Quote" q
      LEFT JOIN "User" u ON u.id = q."ownerId"
      WHERE u.id IS NULL`,
  },
  {
    name: "quote_orphan_salesperson",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "Quote" q
      LEFT JOIN "User" u ON u.id = q."salespersonId"
      WHERE q."salespersonId" IS NOT NULL AND u.id IS NULL`,
  },
  {
    name: "quote_version_missing_quote",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "QuoteVersion" v
      LEFT JOIN "Quote" q ON q.id = v."quoteId"
      WHERE q.id IS NULL`,
  },
  {
    name: "quote_version_missing_created_by",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "QuoteVersion" v
      LEFT JOIN "User" u ON u.id = v."createdById"
      WHERE u.id IS NULL`,
  },
  {
    name: "quote_item_missing_version",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "QuoteItem" i
      LEFT JOIN "QuoteVersion" v ON v.id = i."quoteVersionId"
      WHERE v.id IS NULL`,
  },
  {
    name: "quote_item_orphan_product",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "QuoteItem" i
      LEFT JOIN "Product" p ON p.id = i."productId"
      WHERE i."productId" IS NOT NULL AND p.id IS NULL`,
  },
  {
    name: "quote_main_item_missing_version",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "QuoteMainItem" m
      LEFT JOIN "QuoteVersion" v ON v.id = m."quoteVersionId"
      WHERE v.id IS NULL`,
  },
  {
    name: "quote_item_line_missing_main_item",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "QuoteItemLine" l
      LEFT JOIN "QuoteMainItem" m ON m.id = l."quoteMainItemId"
      WHERE m.id IS NULL`,
  },
  {
    name: "quote_item_line_orphan_product",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "QuoteItemLine" l
      LEFT JOIN "Product" p ON p.id = l."productId"
      WHERE l."productId" IS NOT NULL AND p.id IS NULL`,
  },
  {
    name: "fv_study_missing_client",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "FvStudy" s
      LEFT JOIN "Client" c ON c.id = s."clientId"
      WHERE c.id IS NULL`,
  },
  {
    name: "fv_study_orphan_owner",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "FvStudy" s
      LEFT JOIN "User" u ON u.id = s."ownerId"
      WHERE s."ownerId" IS NOT NULL AND u.id IS NULL`,
  },
  {
    name: "conversation_missing_creator",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "Conversation" c
      LEFT JOIN "User" u ON u.id = c."createdById"
      WHERE u.id IS NULL`,
  },
  {
    name: "conversation_member_missing_conversation",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "ConversationMember" m
      LEFT JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c.id IS NULL`,
  },
  {
    name: "conversation_member_missing_user",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "ConversationMember" m
      LEFT JOIN "User" u ON u.id = m."userId"
      WHERE u.id IS NULL`,
  },
  {
    name: "message_missing_conversation",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "Message" m
      LEFT JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c.id IS NULL`,
  },
  {
    name: "message_missing_author",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "Message" m
      LEFT JOIN "User" u ON u.id = m."authorId"
      WHERE u.id IS NULL`,
  },
  {
    name: "task_missing_project",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "Task" t
      LEFT JOIN "Project" p ON p.id = t."projectId"
      WHERE p.id IS NULL`,
  },
  {
    name: "task_orphan_assignee",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "Task" t
      LEFT JOIN "User" u ON u.id = t."assigneeUserId"
      WHERE t."assigneeUserId" IS NOT NULL AND u.id IS NULL`,
  },
  {
    name: "transport_trip_commercial_missing_project",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "TransportTripCommercial" t
      LEFT JOIN "Project" p ON p.id = t."projectId"
      WHERE p.id IS NULL`,
  },
  {
    name: "transport_trip_cost_line_missing_trip",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "TransportTripCostLine" l
      LEFT JOIN "TransportTripCommercial" t ON t.id = l."tripId"
      WHERE t.id IS NULL`,
  },
  {
    name: "inventory_item_orphan_project",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "InventoryItem" i
      LEFT JOIN "Project" p ON p.id = i."projectId"
      WHERE i."projectId" IS NOT NULL AND p.id IS NULL`,
  },
  {
    name: "inventory_item_orphan_quote",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "InventoryItem" i
      LEFT JOIN "Quote" q ON q.id = i."quoteId"
      WHERE i."quoteId" IS NOT NULL AND q.id IS NULL`,
  },
  {
    name: "inventory_item_orphan_product",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "InventoryItem" i
      LEFT JOIN "Product" p ON p.id = i."productId"
      WHERE i."productId" IS NOT NULL AND p.id IS NULL`,
  },
  {
    name: "user_role_missing_user",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "UserRole" ur
      LEFT JOIN "User" u ON u.id = ur."userId"
      WHERE u.id IS NULL`,
  },
  {
    name: "user_role_missing_role",
    sql: Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM "UserRole" ur
      LEFT JOIN "Role" r ON r.id = ur."roleId"
      WHERE r.id IS NULL`,
  },
];

async function main() {
  const prisma = new PrismaClient();
  const results: { name: string; count: number }[] = [];

  try {
    for (const c of checks) {
      const rows = await prisma.$queryRaw<{ n: bigint }[]>(c.sql);
      const n = Number(rows[0]?.n ?? 0);
      results.push({ name: c.name, count: n });
    }
  } finally {
    await prisma.$disconnect();
  }

  const outDir = path.join(process.cwd(), "test-results");
  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    results,
    failed: results.filter((r) => r.count > 0),
  };
  fs.writeFileSync(path.join(outDir, "integrity-report.json"), JSON.stringify(payload, null, 2), "utf8");

  const bad = payload.failed;
  if (bad.length) {
    console.error("[integrity:db] Relaciones con filas huérfanas:", JSON.stringify(bad, null, 2));
    process.exit(1);
  }
  console.log("[integrity:db] OK — sin huérfanos en comprobaciones definidas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
