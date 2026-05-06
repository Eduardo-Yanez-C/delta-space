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
      return {
        ok: true,
        database: true,
        storage: this.objectStorage.describe(),
        timestamp: new Date().toISOString(),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException({ ok: false, database: false, error: msg });
    }
  }
}
