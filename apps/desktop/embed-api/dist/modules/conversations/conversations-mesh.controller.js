"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ConversationsMeshController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsMeshController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const conversation_presence_service_1 = require("./conversation-presence.service");
const lan_mesh_guard_1 = require("./lan-mesh.guard");
/**
 * Lectura interna entre nodos en la misma LAN (no JWT de usuario).
 * Sincroniza identidad y presencia para un directorio de conversaciones unificado.
 */
let ConversationsMeshController = ConversationsMeshController_1 = class ConversationsMeshController {
    constructor(prisma, presence) {
        this.prisma = prisma;
        this.presence = presence;
        this.log = new common_1.Logger(ConversationsMeshController_1.name);
    }
    /** Usuarios activos + hash de contraseña (bcrypt) para replicar cuenta en el líder sin cambiar credenciales. */
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
                emailType: typeof u.email,
                email: u.email,
                name: u.name,
                fullName: u.fullName,
            }));
            this.log.warn(JSON.stringify({
                pvLanMeshUsers: true,
                missingEmailCount: missing.length,
                samples,
            }));
        }
        return { users };
    }
    /** Emails con sesión realtime abierta en este nodo. */
    async meshPresence() {
        const ids = this.presence.getPresentUserIds();
        if (ids.length === 0) {
            return { onlineEmails: [] };
        }
        const rows = await this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: { email: true },
        });
        const onlineEmails = rows.map((r) => r.email.trim().toLowerCase());
        return { onlineEmails };
    }
};
exports.ConversationsMeshController = ConversationsMeshController;
__decorate([
    (0, common_1.Get)("users"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConversationsMeshController.prototype, "meshUsers", null);
__decorate([
    (0, common_1.Get)("presence"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConversationsMeshController.prototype, "meshPresence", null);
exports.ConversationsMeshController = ConversationsMeshController = ConversationsMeshController_1 = __decorate([
    (0, common_1.Controller)("lan/mesh"),
    (0, common_1.UseGuards)(lan_mesh_guard_1.LanMeshGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        conversation_presence_service_1.ConversationPresenceService])
], ConversationsMeshController);
