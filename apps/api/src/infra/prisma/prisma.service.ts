import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { getRequestContext } from "../request-context";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
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
      try {
        await this.$executeRaw`SELECT set_config('app.company_id', ${ctx.companyId}, true), set_config('app.is_admin', ${ctx.isAdmin ? "true" : "false"}, true)`;
      } catch (e) {
        // En algunos despliegues (p. ej. pooler) `set_config` puede fallar; sin esto todo el request devuelve 500.
        // Tablas sin RLS (p. ej. Company, Role) siguen siendo legibles; revisar logs y cadena de conexión.
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`set_config RLS omitido tras error: ${msg}`);
      }
      return next(params);
    });

    // Conexión en segundo plano: no bloquear `app.listen` ni healthchecks si la DB tarda o falla al arranque.
    void this.$connect().catch((e) => {
      console.error("[PrismaService] $connect diferido falló (el API sigue arriba):", e);
    });
  }
}
