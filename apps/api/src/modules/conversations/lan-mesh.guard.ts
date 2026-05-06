import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

/**
 * Protege endpoints de malla LAN (directorio/presencia entre nodos).
 * Mismo valor en todos los equipos: `LAN_MESH_SECRET` (mín. 8 caracteres).
 * Header: `X-Lan-Mesh-Secret: <valor>`
 */
@Injectable()
export class LanMeshGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = (process.env.LAN_MESH_SECRET ?? "").trim();
    if (secret.length < 8) {
      throw new ForbiddenException("LAN mesh no configurado");
    }
    const req = context.switchToHttp().getRequest<Request>();
    const h = req.headers["x-lan-mesh-secret"];
    const sent = typeof h === "string" ? h.trim() : "";
    if (sent !== secret) {
      throw new ForbiddenException("LAN mesh inválido");
    }
    return true;
  }
}
