import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as dgram from "dgram";
import * as https from "https";
import * as os from "os";
import { randomUUID } from "crypto";

/** Multicast site-local: mismo grupo en toda la LAN para anuncios/discovery. */
const MULTICAST_GROUP = "239.12.34.56";
const DEFAULT_UDP_PORT = 40201;
const MAGIC = "PVQ_LAN_V1";
const PEER_TTL_MS = 90_000;
const ANNOUNCE_INTERVAL_MS = 12_000;
const INTERNET_CHECK_INTERVAL_MS = 45_000;
const INTERNET_CHECK_TIMEOUT_MS = 3500;

export type LanPeerInfo = {
  address: string;
  apiPort: number;
  hostname: string;
  instanceId: string;
  /** Milisegundos desde el último anuncio recibido. */
  lastSeenAgeMs: number;
};

export type LanDiscoveryStatus = {
  enabled: boolean;
  error?: string;
  multicastGroup: string;
  udpPort: number;
  instanceId: string;
  apiPort: number;
  hostname: string;
  internetReachable: boolean | null;
  internetCheckedAtMs: number | null;
  peers: LanPeerInfo[];
  peerCount: number;
};

@Injectable()
export class LanDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(LanDiscoveryService.name);
  private readonly instanceId = randomUUID();
  private socket: dgram.Socket | null = null;
  private readonly peers = new Map<
    string,
    { address: string; apiPort: number; hostname: string; instanceId: string; seenAt: number }
  >();
  private announceTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private internetTimer: ReturnType<typeof setInterval> | null = null;
  private internetReachable: boolean | null = null;
  private internetCheckedAtMs: number | null = null;
  private udpPort = DEFAULT_UDP_PORT;
  private bindError: string | null = null;

  constructor(private readonly config: ConfigService) {}

  getApiPort(): number {
    const p = this.config.get<string>("PORT") ?? process.env.PORT ?? "4000";
    const n = parseInt(String(p), 10);
    return Number.isFinite(n) && n > 0 ? n : 4000;
  }

  getUdpPort(): number {
    const raw = this.config.get<string>("LAN_DISCOVERY_PORT") ?? process.env.LAN_DISCOVERY_PORT;
    const n = raw != null ? parseInt(String(raw), 10) : DEFAULT_UDP_PORT;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_UDP_PORT;
  }

  onModuleInit(): void {
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
        } catch (e) {
          this.log.warn(`Multicast join: ${e instanceof Error ? e.message : e}`);
        }
        this.sendAnnounce();
      });
      this.announceTimer = setInterval(() => this.sendAnnounce(), ANNOUNCE_INTERVAL_MS);
      this.pruneTimer = setInterval(() => this.prunePeers(), 5000);
      this.internetTimer = setInterval(() => this.probeInternet(), INTERNET_CHECK_INTERVAL_MS);
      void this.probeInternet();
    } catch (e) {
      this.bindError = e instanceof Error ? e.message : String(e);
      this.log.warn(`LAN UDP no disponible: ${this.bindError}`);
      this.socket = null;
    }
  }

  onModuleDestroy(): void {
    if (this.announceTimer) clearInterval(this.announceTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.internetTimer) clearInterval(this.internetTimer);
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* no-op */
      }
      this.socket = null;
    }
  }

  getStatus(): LanDiscoveryStatus {
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

  private announcePayload(): string {
    return JSON.stringify({
      i: this.instanceId,
      p: this.getApiPort(),
      h: os.hostname(),
    });
  }

  /** Multicast DISCOVER para que otros nodos respondan con ANNOUNCE unicast (útil al consultar el estado). */
  triggerDiscoveryProbe(): void {
    if (!this.socket) return;
    const buf = Buffer.from(`${MAGIC}:DISCOVER`, "utf8");
    this.socket.send(buf, 0, buf.length, this.udpPort, MULTICAST_GROUP, (err) => {
      if (err) this.log.debug(`DISCOVER send: ${err.message}`);
    });
  }

  private sendAnnounce(): void {
    if (!this.socket) return;
    const body = `${MAGIC}:ANNOUNCE:${this.announcePayload()}`;
    const buf = Buffer.from(body, "utf8");
    this.socket.send(buf, 0, buf.length, this.udpPort, MULTICAST_GROUP, (err) => {
      if (err) this.log.debug(`Multicast send: ${err.message}`);
    });
  }

  private sendUnicastAnnounce(port: number, address: string): void {
    if (!this.socket) return;
    const body = `${MAGIC}:ANNOUNCE:${this.announcePayload()}`;
    const buf = Buffer.from(body, "utf8");
    this.socket.send(buf, 0, buf.length, port, address, (err) => {
      if (err) this.log.debug(`Unicast announce: ${err.message}`);
    });
  }

  private onUdpMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    const text = msg.toString("utf8").trim();
    if (!text.startsWith(`${MAGIC}:`)) return;
    const rest = text.slice(MAGIC.length + 1);
    if (rest.startsWith("DISCOVER")) {
      this.sendUnicastAnnounce(rinfo.port, rinfo.address);
      return;
    }
    if (!rest.startsWith("ANNOUNCE:")) return;
    let parsed: { i?: string; p?: number; h?: string };
    try {
      parsed = JSON.parse(rest.slice("ANNOUNCE:".length)) as { i?: string; p?: number; h?: string };
    } catch {
      return;
    }
    if (!parsed.i || parsed.i === this.instanceId) return;
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

  private prunePeers(): void {
    const now = Date.now();
    for (const [k, v] of this.peers) {
      if (now - v.seenAt > PEER_TTL_MS) this.peers.delete(k);
    }
  }

  private probeInternet(): Promise<void> {
    return new Promise((resolve) => {
      const req = https.get(
        "https://connectivitycheck.gstatic.com/generate_204",
        { timeout: INTERNET_CHECK_TIMEOUT_MS },
        (res) => {
          res.resume();
          this.internetReachable = res.statusCode === 204 || res.statusCode === 200;
          this.internetCheckedAtMs = Date.now();
          resolve();
        },
      );
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
}
