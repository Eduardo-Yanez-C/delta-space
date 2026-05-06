/**
 * Recuperación mínima de acceso: roles base + usuario admin.
 * No toca catálogo, plantillas ni otros datos. Mantener alineado con seedRolesAndAdmin en seed.ts.
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const ROLE_DEFINITIONS = [
  {
    name: "ADMIN_DEV",
    description:
      "Administrador desarrollador (root): todos los permisos; gestión de roles elevados y configuración crítica.",
  },
  {
    name: "ADMIN",
    description:
      "Administrador operativo: módulos principales y gestión de usuarios subordinados (no ADMIN ni ADMIN_DEV).",
  },
  {
    name: "VENDEDOR_TECNICO",
    description:
      "Vendedor técnico: clientes, estudios FV, cotizaciones, plantillas, diseño/implantación; sin administración global.",
  },
  {
    name: "INGENIERIA",
    description: "Lectura técnica; apoyo en cálculo FV y cotizaciones.",
  },
  { name: "LECTURA", description: "Solo visualización." },
];

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "(no DATABASE_URL)";
  console.log("DATABASE_URL:", dbUrl);

  for (const r of ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: { name: r.name },
      create: r,
      update: { description: r.description },
    });
  }

  const ventasRole = await prisma.role.findUnique({ where: { name: "VENTAS" } });
  const vendedorTecnicoRole = await prisma.role.findUnique({
    where: { name: "VENDEDOR_TECNICO" },
  });
  if (ventasRole && vendedorTecnicoRole) {
    const links = await prisma.userRole.findMany({ where: { roleId: ventasRole.id } });
    for (const ur of links) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: ur.userId, roleId: vendedorTecnicoRole.id } },
        create: { userId: ur.userId, roleId: vendedorTecnicoRole.id },
        update: {},
      });
    }
    await prisma.userRole.deleteMany({ where: { roleId: ventasRole.id } });
    await prisma.role.delete({ where: { id: ventasRole.id } });
    console.log("Rol VENTAS migrado a VENDEDOR_TECNICO y eliminado.");
  }

  const adminDevRole = await prisma.role.findUnique({ where: { name: "ADMIN_DEV" } });
  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  if (!adminDevRole || !adminRole) {
    throw new Error("Roles ADMIN_DEV o ADMIN no encontrados tras sincronizar.");
  }

  const email = "eduardo.yanez.concha@gmail.com".toLowerCase();
  const before = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });
  console.log("Antes:", before ? { exists: true, active: before.active, roles: before.roles.map((r) => r.role.name) } : { exists: false });

  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: hashedPassword,
      name: "Administrador",
      active: true,
    },
    update: {
      password: hashedPassword,
      name: "Administrador",
      active: true,
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: admin.id, roleId: adminRole.id } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminDevRole.id } },
    create: { userId: admin.id, roleId: adminDevRole.id },
    update: {},
  });

  const after = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });
  const ok = await bcrypt.compare("admin123", after!.password);
  console.log("Después:", {
    email: after!.email,
    active: after!.active,
    roles: after!.roles.map((r) => r.role.name),
    bcryptCheck: ok,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
