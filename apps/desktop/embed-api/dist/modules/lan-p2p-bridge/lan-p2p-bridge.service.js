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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LanP2pBridgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanP2pBridgeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const net = __importStar(require("net"));
/**
 * Cliente del daemon `lan-p2p` (libp2p) por TCP local (127.0.0.1).
 */
let LanP2pBridgeService = LanP2pBridgeService_1 = class LanP2pBridgeService {
    constructor(config) {
        this.config = config;
        this.log = new common_1.Logger(LanP2pBridgeService_1.name);
        const raw = (this.config.get("P2P_CONTROL_ADDR") ?? process.env.P2P_CONTROL_ADDR ?? "")
            .trim();
        if (raw === "" || raw === "0") {
            this.enabled = false;
            this.host = "127.0.0.1";
            this.port = 40777;
            this.log.log("LanP2pBridge desactivado (P2P_CONTROL_ADDR vacío).");
        }
        else {
            this.enabled = true;
            const i = raw.lastIndexOf(":");
            if (i > 0) {
                this.host = raw.slice(0, i);
                this.port = parseInt(raw.slice(i + 1), 10) || 40777;
            }
            else {
                this.host = "127.0.0.1";
                this.port = parseInt(raw, 10) || 40777;
            }
        }
    }
    isEnabled() {
        return this.enabled;
    }
    onModuleDestroy() { }
    async execLine(jsonLine) {
        return new Promise((resolve, reject) => {
            const sock = net.createConnection({ host: this.host, port: this.port }, () => {
                sock.write(`${jsonLine}\n`);
            });
            let buf = "";
            sock.setTimeout(30_000);
            sock.on("data", (chunk) => {
                buf += chunk.toString("utf8");
                if (buf.includes("\n")) {
                    sock.end();
                }
            });
            sock.on("end", () => {
                try {
                    const line = buf.split("\n")[0]?.trim() ?? "";
                    resolve(line ? JSON.parse(line) : {});
                }
                catch (e) {
                    reject(e);
                }
            });
            sock.on("error", (e) => reject(e));
            sock.on("timeout", () => {
                sock.destroy();
                reject(new Error("P2P control timeout"));
            });
        });
    }
    async ping() {
        if (!this.enabled)
            return false;
        try {
            const r = await this.execLine(JSON.stringify({ cmd: "ping" }));
            return r["ok"] === true && r["pong"] === true;
        }
        catch (e) {
            this.log.warn(`P2P ping: ${e instanceof Error ? e.message : e}`);
            return false;
        }
    }
    async getLocalPeerIdJson() {
        if (!this.enabled)
            return { ok: false, error: "bridge_disabled" };
        try {
            const r = await this.execLine(JSON.stringify({ cmd: "get_peer_id" }));
            const pid = r["peer_id"];
            if (typeof pid === "string" && pid.length > 0) {
                return { ok: true, peer_id: pid };
            }
            return { ok: false, error: "no_peer_id" };
        }
        catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    }
    async sendDirectMessage(peerId, envelope) {
        if (!this.enabled)
            return { ok: false, error: "disabled" };
        const cmd = { cmd: "send_rr", peer_id: peerId, envelope };
        try {
            const r = await this.execLine(JSON.stringify(cmd));
            if (r["ok"] === false) {
                return { ok: false, error: String(r["error"] ?? "send_failed"), queued: r["queued"] === true };
            }
            return { ok: true, queued: r["queued"] === true };
        }
        catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    }
    async publishPresence(event) {
        if (!this.enabled)
            return;
        const cmd = { cmd: "publish_presence", event };
        await this.execLine(JSON.stringify(cmd));
    }
    async setLocalIdentity(userId, installationId, displayName) {
        if (!this.enabled)
            return;
        await this.execLine(JSON.stringify({
            cmd: "set_identity",
            user_id: userId,
            installation_id: installationId,
            display_name: displayName ?? "",
        }));
    }
    /**
     * Inicia transferencia saliente en el daemon (ruta local + metadatos; chunks y FILE_COMPLETE los maneja lan-p2p).
     */
    async sendFileFromPath(opts) {
        if (!this.enabled)
            return { ok: false, error: "disabled" };
        const cmd = {
            cmd: "send_file_from_path",
            peer_id: opts.peerId,
            transfer_id: opts.transferId,
            conversation_id: opts.conversationId,
            file_name: opts.fileName,
            mime_type: opts.mimeType,
            local_path: opts.localPath,
            size_bytes: opts.sizeBytes,
            sha256_hex: opts.sha256Hex,
            chunk_size: opts.chunkSize,
            total_chunks: opts.totalChunks,
            sender_installation_id: opts.senderInstallationId,
        };
        try {
            const r = await this.execLine(JSON.stringify(cmd));
            if (r["ok"] === false) {
                return { ok: false, error: String(r["error"] ?? "send_failed") };
            }
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    }
    startLanNetworking() {
        if (!this.enabled) {
            this.log.debug("startLanNetworking: sin P2P_CONTROL_ADDR.");
        }
    }
};
exports.LanP2pBridgeService = LanP2pBridgeService;
exports.LanP2pBridgeService = LanP2pBridgeService = LanP2pBridgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LanP2pBridgeService);
