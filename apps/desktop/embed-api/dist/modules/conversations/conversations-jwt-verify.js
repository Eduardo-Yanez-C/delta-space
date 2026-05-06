"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecretsForConversationsSocket = getJwtSecretsForConversationsSocket;
exports.verifyJwtForConversationsSocket = verifyJwtForConversationsSocket;
const common_1 = require("@nestjs/common");
const jwt = __importStar(require("jsonwebtoken"));
/**
 * Secreto principal + opcionales (mismo valor que `JWT_SECRET` de otros equipos en LAN).
 * Solo se usa en el gateway de conversaciones, no en el resto del API HTTP.
 */
function getJwtSecretsForConversationsSocket() {
    const primary = process.env.JWT_SECRET?.trim();
    const raw = process.env.JWT_TRUSTED_SECRETS ?? "";
    const extras = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    const list = [];
    if (primary)
        list.push(primary);
    for (const e of extras) {
        if (!list.includes(e))
            list.push(e);
    }
    return list;
}
function verifyJwtForConversationsSocket(token) {
    const secrets = getJwtSecretsForConversationsSocket();
    if (secrets.length === 0) {
        throw new common_1.UnauthorizedException("JWT_SECRET no configurado");
    }
    let lastErr;
    for (const secret of secrets) {
        try {
            const decoded = jwt.verify(token, secret);
            if (typeof decoded.sub !== "string" || decoded.sub.trim() === "") {
                continue;
            }
            const email = typeof decoded.email === "string" && decoded.email.trim() !== ""
                ? decoded.email.trim().toLowerCase()
                : undefined;
            return { sub: decoded.sub.trim(), email };
        }
        catch (e) {
            lastErr = e;
        }
    }
    void lastErr;
    throw new common_1.UnauthorizedException("Token inválido");
}
