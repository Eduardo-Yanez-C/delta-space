/**
 * CLI: `npm run seed:mejora-demo-project` (misma lógica que el seed principal cuando incluye demo CSO).
 */
import { PrismaClient } from "@prisma/client";
import { runMejoraCsoDemoSeed } from "./seed-mejora-demo-project-core";

const prisma = new PrismaClient();

runMejoraCsoDemoSeed(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
