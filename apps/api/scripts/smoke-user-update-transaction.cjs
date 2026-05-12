/**
 * Ejecuta localmente la misma transacción que UsersService.update (escalar + roles).
 * Requiere Postgres accesible (DATABASE_URL en apps/api/.env), p. ej.:
 *   docker compose -f docker-compose.postgres.yml up -d
 * Uso desde apps/api:
 *   node scripts/smoke-user-update-transaction.cjs [fragmento-email]
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const needle = (process.argv[2] || "galvez").toLowerCase();

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email: { contains: needle, mode: "insensitive" } },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      const any = await prisma.user.findFirst({
        include: { roles: { include: { role: true } } },
      });
      console.log("No match for email needle:", needle);
      console.log("First user in DB:", any?.email, any?.id);
      return;
    }
    const id = user.id;
    const roleIds = user.roles.filter((ur) => ur.role).map((ur) => ur.roleId);
    console.log("Smoke user:", user.email, "id:", id, "roleIds:", roleIds);

    const scalarData = {
      suiteAgentMonthlyTokenLimit: (user.suiteAgentMonthlyTokenLimit ?? 0) + 1,
      accessExpiresAt: new Date("2027-12-31T23:59:59.999Z"),
    };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: scalarData });
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
    });
    console.log("OK: transacción completada.");
  } catch (e) {
    console.error("FAIL:", e?.code || "", e?.message || e);
    if (e?.meta) console.error("meta:", JSON.stringify(e.meta));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
