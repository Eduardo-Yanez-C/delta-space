"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.P2pIngressGuard = void 0;
exports.ensureP2pIngressSecretAuto = ensureP2pIngressSecretAuto;
const common_1 = require("@nestjs/common");
function getIngressSecret() {
    return (process.env.P2P_INGRESS_SECRET ?? "").trim();
}
function ensureP2pIngressSecretAuto() {
    const existing = getIngressSecret();
    if (existing.length >= 8)
        return;
    const hmac = (process.env.LICENSE_HMAC_SECRET ?? "").trim();
    if (hmac.length >= 8) {
        process.env.P2P_INGRESS_SECRET = hmac.slice(0, 32);
    }
}
let P2pIngressGuard = class P2pIngressGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const header = (req.headers["x-p2p-secret"] ?? req.headers["X-P2P-SECRET"]);
        const secret = (header ?? "").trim();
        const expected = getIngressSecret();
        if (expected.length < 8) {
            throw new common_1.UnauthorizedException("P2P ingress no configurado");
        }
        if (secret !== expected) {
            throw new common_1.UnauthorizedException("P2P ingress inválido");
        }
        req.p2pIngressOk = true;
        return true;
    }
};
exports.P2pIngressGuard = P2pIngressGuard;
exports.P2pIngressGuard = P2pIngressGuard = __decorate([
    (0, common_1.Injectable)()
], P2pIngressGuard);
