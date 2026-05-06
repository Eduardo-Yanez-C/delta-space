"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanMeshGuard = void 0;
const common_1 = require("@nestjs/common");
/**
 * Protege endpoints de malla LAN (directorio/presencia entre nodos).
 * Mismo valor en todos los equipos: `LAN_MESH_SECRET` (mín. 8 caracteres).
 * Header: `X-Lan-Mesh-Secret: <valor>`
 */
let LanMeshGuard = class LanMeshGuard {
    canActivate(context) {
        const secret = (process.env.LAN_MESH_SECRET ?? "").trim();
        if (secret.length < 8) {
            throw new common_1.ForbiddenException("LAN mesh no configurado");
        }
        const req = context.switchToHttp().getRequest();
        const h = req.headers["x-lan-mesh-secret"];
        const sent = typeof h === "string" ? h.trim() : "";
        if (sent !== secret) {
            throw new common_1.ForbiddenException("LAN mesh inválido");
        }
        return true;
    }
};
exports.LanMeshGuard = LanMeshGuard;
exports.LanMeshGuard = LanMeshGuard = __decorate([
    (0, common_1.Injectable)()
], LanMeshGuard);
