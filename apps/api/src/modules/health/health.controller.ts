import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ObjectStorageService } from "../../infra/object-storage/object-storage.service";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  /** GET /api/health — listo para probes en Railway/Render. */
  @Get()
  async ping() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const sd = process.env.STORAGE_DRIVER;
      return {
        ok: true,
        database: true,
        storage: this.objectStorage.describe(),
        /** Diagnóstico sin exponer el valor (p. ej. Railway: variable no inyectada o nombre mal copiado). */
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
