import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { getRequestContext } from "../request-context";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();

    // RLS: setea variables de sesión por request (companyId + bypass admin).
    this.$use(async (params, next) => {
      // Evitar recursión en executeRaw / queryRaw
      if (params.action === "executeRaw" || params.action === "queryRaw") {
        return next(params);
      }
      const ctx = getRequestContext();
      if (!ctx) return next(params);

      // Usa `true` para que sea LOCAL (por transacción/statement).
      // Nota: Prisma puede reutilizar conexiones; set_config LOCAL reduce riesgo de fuga entre requests.
      await this.$executeRaw`SELECT set_config('app.company_id', ${ctx.companyId}, true), set_config('app.is_admin', ${ctx.isAdmin ? "true" : "false"}, true)`;
      return next(params);
    });
  }
}
