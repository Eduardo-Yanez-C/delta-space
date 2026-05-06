import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as net from "net";
import type { DirectEnvelope, PresenceGossip } from "./lan-p2p-protocol.types";

/**
 * Cliente del daemon `lan-p2p` (libp2p) por TCP local (127.0.0.1).
 */
@Injectable()
export class LanP2pBridgeService implements OnModuleDestroy {
  private readonly log = new Logger(LanP2pBridgeService.name);
  private readonly host: string;
  private readonly port: number;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const raw = (this.config.get<string>("P2P_CONTROL_ADDR") ?? process.env.P2P_CONTROL_ADDR ?? "")
      .trim();
    if (raw === "" || raw === "0") {
      this.enabled = false;
      this.host = "127.0.0.1";
      this.port = 40777;
      this.log.log("LanP2pBridge desactivado (P2P_CONTROL_ADDR vacío).");
    } else {
      this.enabled = true;
      const i = raw.lastIndexOf(":");
      if (i > 0) {
        this.host = raw.slice(0, i);
        this.port = parseInt(raw.slice(i + 1), 10) || 40777;
      } else {
        this.host = "127.0.0.1";
        this.port = parseInt(raw, 10) || 40777;
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  onModuleDestroy(): void {}

  private async execLine(jsonLine: string): Promise<Record<string, unknown>> {
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
          resolve(line ? (JSON.parse(line) as Record<string, unknown>) : {});
        } catch (e) {
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

  async ping(): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const r = await this.execLine(JSON.stringify({ cmd: "ping" }));
      return r["ok"] === true && r["pong"] === true;
    } catch (e) {
      this.log.warn(`P2P ping: ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }

  async getLocalPeerIdJson(): Promise<{ ok: boolean; peer_id?: string; error?: string }> {
    if (!this.enabled) return { ok: false, error: "bridge_disabled" };
    try {
      const r = await this.execLine(JSON.stringify({ cmd: "get_peer_id" }));
      const pid = r["peer_id"];
      if (typeof pid === "string" && pid.length > 0) {
        return { ok: true, peer_id: pid };
      }
      return { ok: false, error: "no_peer_id" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async sendDirectMessage(peerId: string, envelope: DirectEnvelope): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
    if (!this.enabled) return { ok: false, error: "disabled" };
    const cmd = { cmd: "send_rr", peer_id: peerId, envelope };
    try {
      const r = await this.execLine(JSON.stringify(cmd));
      if (r["ok"] === false) {
        return { ok: false, error: String(r["error"] ?? "send_failed"), queued: r["queued"] === true };
      }
      return { ok: true, queued: r["queued"] === true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async publishPresence(event: PresenceGossip): Promise<void> {
    if (!this.enabled) return;
    const cmd = { cmd: "publish_presence", event };
    await this.execLine(JSON.stringify(cmd));
  }

  async setLocalIdentity(userId: string, installationId: string, displayName?: string): Promise<void> {
    if (!this.enabled) return;
    await this.execLine(
      JSON.stringify({
        cmd: "set_identity",
        user_id: userId,
        installation_id: installationId,
        display_name: displayName ?? "",
      }),
    );
  }

  /**
   * Inicia transferencia saliente en el daemon (ruta local + metadatos; chunks y FILE_COMPLETE los maneja lan-p2p).
   */
  async sendFileFromPath(opts: {
    peerId: string;
    transferId: string;
    conversationId: string;
    fileName: string;
    mimeType: string;
    localPath: string;
    sizeBytes: number;
    sha256Hex: string;
    chunkSize: number;
    totalChunks: number;
    senderInstallationId: string;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.enabled) return { ok: false, error: "disabled" };
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
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  startLanNetworking(): void {
    if (!this.enabled) {
      this.log.debug("startLanNetworking: sin P2P_CONTROL_ADDR.");
    }
  }
}
