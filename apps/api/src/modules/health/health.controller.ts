import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ObjectStorageService } from "../../infra/object-storage/object-storage.service";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  /**
   * GET /api/health — **liveness** (Railway/Render/K8s): 200 si el proceso Nest responde.
   * No toca Postgres: un pooler saturado o un fallo transitorio de DB no debe tumbar el deploy
   * ni marcar el contenedor como no saludable mientras la API está arriba.
   */
  @Get()
  live() {
    return {
      ok: true,
      probe: "liveness",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/health/ready — **readiness**: DB + storage. 503 si la base no responde.
   * Usar para comprobaciones manuales o monitores que sí deban alertar por dependencias.
   */
  @Get("ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const sd = process.env.STORAGE_DRIVER;
      return {
        ok: true,
        probe: "readiness",
        database: true,
        storage: this.objectStorage.describe(),
        storageDriverEnv: {
          defined: sd !== undefined && sd !== "",
          length: sd?.length ?? 0,
          firstCharCode: sd && sd.length > 0 ? sd.charCodeAt(0) : null,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException({ ok: false, database: false, error: msg });
    }
  }
}
