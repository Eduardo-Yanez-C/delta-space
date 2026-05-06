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
var LanDiscoveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dgram = __importStar(require("dgram"));
const https = __importStar(require("https"));
const os = __importStar(require("os"));
const crypto_1 = require("crypto");
/** Multicast site-local: mismo grupo en toda la LAN para anuncios/discovery. */
const MULTICAST_GROUP = "239.12.34.56";
const DEFAULT_UDP_PORT = 40201;
const MAGIC = "PVQ_LAN_V1";
const PEER_TTL_MS = 90_000;
const ANNOUNCE_INTERVAL_MS = 12_000;
const INTERNET_CHECK_INTERVAL_MS = 45_000;
const INTERNET_CHECK_TIMEOUT_MS = 3500;
let LanDiscoveryService = LanDiscoveryService_1 = class LanDiscoveryService {
    constructor(config) {
        this.config = config;
        this.log = new common_1.Logger(LanDiscoveryService_1.name);
        this.instanceId = (0, crypto_1.randomUUID)();
        this.socket = null;
        this.peers = new Map();
        this.announceTimer = null;
        this.pruneTimer = null;
        this.internetTimer = null;
        this.internetReachable = null;
        this.internetCheckedAtMs = null;
        this.udpPort = DEFAULT_UDP_PORT;
        this.bindError = null;
    }
    getApiPort() {
        const p = this.config.get("PORT") ?? process.env.PORT ?? "4000";
        const n = parseInt(String(p), 10);
        return Number.isFinite(n) && n > 0 ? n : 4000;
    }
    getUdpPort() {
        const raw = this.config.get("LAN_DISCOVERY_PORT") ?? process.env.LAN_DISCOVERY_PORT;
        const n = raw != null ? parseInt(String(raw), 10) : DEFAULT_UDP_PORT;
        return Number.isFinite(n) && n > 0 ? n : DEFAULT_UDP_PORT;
    }
    onModuleInit() {
        if (process.env.LAN_DISCOVERY_DISABLE === "1") {
            this.log.log("LAN discovery deshabilitado (LAN_DISCOVERY_DISABLE=1)");
            return;
        }
        this.udpPort = this.getUdpPort();
        try {
            const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
            this.socket = s;
            s.on("error", (err) => {
                this.bindError = err.message;
                this.log.warn(`UDP LAN: ${err.message}`);
            });
            s.on("message", (msg, rinfo) => this.onUdpMessage(msg, rinfo));
            s.bind(this.udpPort, () => {
                try {
                    s.setBroadcast(true);
                    s.setMulticastTTL(2);
                    s.addMembership(MULTICAST_GROUP);
                }
                catch (e) {
                    this.log.warn(`Multicast join: ${e instanceof Error ? e.message : e}`);
                }
                this.sendAnnounce();
            });
            this.announceTimer = setInterval(() => this.sendAnnounce(), ANNOUNCE_INTERVAL_MS);
            this.pruneTimer = setInterval(() => this.prunePeers(), 5000);
            this.internetTimer = setInterval(() => this.probeInternet(), INTERNET_CHECK_INTERVAL_MS);
            void this.probeInternet();
        }
        catch (e) {
            this.bindError = e instanceof Error ? e.message : String(e);
            this.log.warn(`LAN UDP no disponible: ${this.bindError}`);
            this.socket = null;
        }
    }
    onModuleDestroy() {
        if (this.announceTimer)
            clearInterval(this.announceTimer);
        if (this.pruneTimer)
            clearInterval(this.pruneTimer);
        if (this.internetTimer)
            clearInterval(this.internetTimer);
        if (this.socket) {
            try {
                this.socket.close();
            }
            catch {
                /* no-op */
            }
            this.socket = null;
        }
    }
    getStatus() {
        const now = Date.now();
        const list = [...this.peers.values()].sort((a, b) => a.address.localeCompare(b.address));
        return {
            enabled: this.socket != null && !this.bindError,
            error: this.bindError ?? undefined,
            multicastGroup: MULTICAST_GROUP,
            udpPort: this.udpPort,
            instanceId: this.instanceId,
            apiPort: this.getApiPort(),
            hostname: os.hostname(),
            internetReachable: this.internetReachable,
            internetCheckedAtMs: this.internetCheckedAtMs,
            peers: list.map((p) => ({
                address: p.address,
                apiPort: p.apiPort,
                hostname: p.hostname,
                instanceId: p.instanceId,
                lastSeenAgeMs: now - p.seenAt,
            })),
            peerCount: list.length,
        };
    }
    announcePayload() {
        return JSON.stringify({
            i: this.instanceId,
            p: this.getApiPort(),
            h: os.hostname(),
        });
    }
    /** Multicast DISCOVER para que otros nodos respondan con ANNOUNCE unicast (útil al consultar el estado). */
    triggerDiscoveryProbe() {
        if (!this.socket)
            return;
        const buf = Buffer.from(`${MAGIC}:DISCOVER`, "utf8");
        this.socket.send(buf, 0, buf.length, this.udpPort, MULTICAST_GROUP, (err) => {
            if (err)
                this.log.debug(`DISCOVER send: ${err.message}`);
        });
    }
    sendAnnounce() {
        if (!this.socket)
            return;
        const body = `${MAGIC}:ANNOUNCE:${this.announcePayload()}`;
        const buf = Buffer.from(body, "utf8");
        this.socket.send(buf, 0, buf.length, this.udpPort, MULTICAST_GROUP, (err) => {
            if (err)
                this.log.debug(`Multicast send: ${err.message}`);
        });
    }
    sendUnicastAnnounce(port, address) {
        if (!this.socket)
            return;
        const body = `${MAGIC}:ANNOUNCE:${this.announcePayload()}`;
        const buf = Buffer.from(body, "utf8");
        this.socket.send(buf, 0, buf.length, port, address, (err) => {
            if (err)
                this.log.debug(`Unicast announce: ${err.message}`);
        });
    }
    onUdpMessage(msg, rinfo) {
        const text = msg.toString("utf8").trim();
        if (!text.startsWith(`${MAGIC}:`))
            return;
        const rest = text.slice(MAGIC.length + 1);
        if (rest.startsWith("DISCOVER")) {
            this.sendUnicastAnnounce(rinfo.port, rinfo.address);
            return;
        }
        if (!rest.startsWith("ANNOUNCE:"))
            return;
        let parsed;
        try {
            parsed = JSON.parse(rest.slice("ANNOUNCE:".length));
        }
        catch {
            return;
        }
        if (!parsed.i || parsed.i === this.instanceId)
            return;
        const apiPort = typeof parsed.p === "number" && parsed.p > 0 ? parsed.p : this.getApiPort();
        const hostname = typeof parsed.h === "string" ? parsed.h : rinfo.address;
        const key = `${rinfo.address}:${apiPort}`;
        this.peers.set(key, {
            address: rinfo.address,
            apiPort,
            hostname,
            instanceId: parsed.i,
            seenAt: Date.now(),
        });
    }
    prunePeers() {
        const now = Date.now();
        for (const [k, v] of this.peers) {
            if (now - v.seenAt > PEER_TTL_MS)
                this.peers.delete(k);
        }
    }
    probeInternet() {
        return new Promise((resolve) => {
            const req = https.get("https://connectivitycheck.gstatic.com/generate_204", { timeout: INTERNET_CHECK_TIMEOUT_MS }, (res) => {
                res.resume();
                this.internetReachable = res.statusCode === 204 || res.statusCode === 200;
                this.internetCheckedAtMs = Date.now();
                resolve();
            });
            req.on("error", () => {
                this.internetReachable = false;
                this.internetCheckedAtMs = Date.now();
                resolve();
            });
            req.on("timeout", () => {
                req.destroy();
                this.internetReachable = false;
                this.internetCheckedAtMs = Date.now();
                resolve();
            });
        });
    }
};
exports.LanDiscoveryService = LanDiscoveryService;
exports.LanDiscoveryService = LanDiscoveryService = LanDiscoveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LanDiscoveryService);
