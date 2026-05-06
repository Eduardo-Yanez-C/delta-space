import { Controller, Get, Logger, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { ConversationPresenceService } from "./conversation-presence.service";
import { LanMeshGuard } from "./lan-mesh.guard";

/**
 * Lectura interna entre nodos en la misma LAN (no JWT de usuario).
 * Sincroniza identidad y presencia para un directorio de conversaciones unificado.
 */
@Controller("lan/mesh")
@UseGuards(LanMeshGuard)
export class ConversationsMeshController {
  private readonly log = new Logger(ConversationsMeshController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: ConversationPresenceService,
  ) {}

  /** Usuarios activos + hash de contraseña (bcrypt) para replicar cuenta en el líder sin cambiar credenciales. */
  @Get("users")
  async meshUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        fullName: true,
        password: true,
      },
    });

    const missing = users.filter((u) => typeof u.email !== "string" || !u.email.trim());
    if (missing.length > 0) {
      const samples = missing.slice(0, 10).map((u) => ({
        id: u.id,
        emailType: typeof (u as any).email,
        email: (u as any).email,
        name: u.name,
        fullName: u.fullName,
      }));
      this.log.warn(
        JSON.stringify({
          pvLanMeshUsers: true,
          missingEmailCount: missing.length,
          samples,
        }),
      );
    }

    return { users };
  }

  /** Emails con sesión realtime abierta en este nodo. */
  @Get("presence")
  async meshPresence() {
    const ids = this.presence.getPresentUserIds();
    if (ids.length === 0) {
      return { onlineEmails: [] as string[] };
    }
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { email: true },
    });
    const onlineEmails = rows.map((r) => r.email.trim().toLowerCase());
    return { onlineEmails };
  }
}
