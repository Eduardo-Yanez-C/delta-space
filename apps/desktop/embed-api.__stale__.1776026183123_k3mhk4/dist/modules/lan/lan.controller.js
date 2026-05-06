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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanController = void 0;
const common_1 = require("@nestjs/common");
const lan_discovery_service_1 = require("./lan-discovery.service");
let LanController = class LanController {
    constructor(lan) {
        this.lan = lan;
    }
    /**
     * Estado LAN + internet (vista servidor). Público allowlist (sin JWT) para diagnóstico y UI de conectividad.
     * Dispara un DISCOVER multicast breve para refrescar respuestas de otros equipos.
     */
    discovery() {
        this.lan.triggerDiscoveryProbe();
        return this.lan.getStatus();
    }
};
exports.LanController = LanController;
__decorate([
    (0, common_1.Get)("discovery"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], LanController.prototype, "discovery", null);
exports.LanController = LanController = __decorate([
    (0, common_1.Controller)("lan"),
    __metadata("design:paramtypes", [lan_discovery_service_1.LanDiscoveryService])
], LanController);
