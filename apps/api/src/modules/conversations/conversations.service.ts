import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import * as path from "path";
import { Prisma } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { ObjectStorageService } from "../../infra/object-storage/object-storage.service";
import type { AuthUserPayload } from "../auth/auth.service";
import { canAccessQuote } from "../quotes/quote-access.helper";
import { LanDiscoveryService } from "../lan/lan-discovery.service";
import { LanP2pBridgeService } from "../lan-p2p-bridge/lan-p2p-bridge.service";
import type { DirectEnvelope } from "../lan-p2p-bridge/lan-p2p-protocol.types";
import { ConversationPresenceService } from "./conversation-presence.service";
import { ConversationsGateway } from "./conversations.gateway";
import type { CreateConversationDto } from "./dto/create-conversation.dto";
import type { CreateMessageDto } from "./dto/create-message.dto";
import type { ResolveSharedEntityDto } from "./dto/resolve-shared-entity.dto";

const MAX_BODY = 10000;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ATTACHMENTS_SUBDIR = "chat-attachments";
/** Tiempo por peer en fetch paralelo (mesh). */
const LAN_MESH_FETCH_MS = 8000;
const P2P_SENT_RETRY_AFTER_MS = 30_000;

type MeshUserRow = {
  id?: string;
  email?: string;
  name?: string | null;
  fullName?: string | null;
  password?: string;
};

/** Hash almacenado (bcrypt) o material mínimo para crear cuenta replicada desde un peer. */
function meshPasswordOkForCreate(p: string | undefined): p is string {
  return typeof p === "string" && p.length >= 10;
}

/** Une filas del mismo email de varios peers: conserva hash si solo uno lo trae; prioriza nombre más completo. */
function mergeMeshUserRows(prev: MeshUserRow | undefined, raw: MeshUserRow, emailLower: string): MeshUserRow {
  const next: MeshUserRow = { ...raw, email: emailLower };
  if (!prev) return next;
  const prevPwd = meshPasswordOkForCreate(prev.password);
  const nextPwd = meshPasswordOkForCreate(next.password);
  const prevLen = (prev.fullName ?? prev.name ?? "").length;
  const nextLen = (next.fullName ?? next.name ?? "").length;
  if (nextPwd && !prevPwd) return next;
  if (prevPwd && !nextPwd) {
    return {
      ...next,
      password: prev.password,
    };
  }
  if (nextLen >= prevLen) {
    return {
      ...next,
      password: nextPwd ? next.password : prev.password,
    };
  }
  return {
    ...prev,
    password: prevPwd ? prev.password : next.password,
  };
}

type StoredMetadata = {
  mentions: string[];
  quoteRefs: {
    quoteId: string;
    titleSnapshot: string;
    commercialNumberSnapshot: string | null;
  }[];
  replyTo: {
    messageId: string;
    authorNameSnapshot: string;
    bodySnippet: string;
  } | null;
};

type SharedEntityApi = {
  entityType: string;
  sourceUserId: string;
  sourceUserName: string;
  sourceNodeName: string;
  sourceEntityId: string | null;
  snapshot: Record<string, unknown>;
  myStatus: "PENDING" | "INTEGRATED" | "REJECTED" | "ERROR" | null;
  myResolutionMode: "CREATE_NEW" | "USE_EXISTING" | "LINK_EXISTING" | "REJECT" | null;
  myTargetEntityId: string | null;
  myErrorMessage: string | null;
};

type ReactionGroupApi = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

type AttachmentApi = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
};

function parseMetadataStored(raw: string | null): StoredMetadata | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") {
      return null;
    }
    const obj = o as Record<string, unknown>;
    const mentions = Array.isArray(obj.mentions)
      ? obj.mentions.filter((x): x is string => typeof x === "string")
      : [];
    const quoteRefsRaw = obj.quoteRefs;
    const quoteRefs: StoredMetadata["quoteRefs"] = [];
    if (Array.isArray(quoteRefsRaw)) {
      for (const r of quoteRefsRaw) {
        if (!r || typeof r !== "object") {
          continue;
        }
        const q = r as Record<string, unknown>;
        if (
          typeof q.quoteId === "string" &&
          typeof q.titleSnapshot === "string"
        ) {
          quoteRefs.push({
            quoteId: q.quoteId,
            titleSnapshot: q.titleSnapshot,
            commercialNumberSnapshot:
              q.commercialNumberSnapshot === null ||
              q.commercialNumberSnapshot === undefined
                ? null
                : String(q.commercialNumberSnapshot),
          });
        }
      }
    }
    const replyToRaw = obj.replyTo;
    let replyTo: StoredMetadata["replyTo"] = null;
    if (replyToRaw && typeof replyToRaw === "object") {
      const r = replyToRaw as Record<string, unknown>;
      if (
        typeof r.messageId === "string" &&
        typeof r.authorNameSnapshot === "string" &&
        typeof r.bodySnippet === "string"
      ) {
        replyTo = {
          messageId: r.messageId,
          authorNameSnapshot: r.authorNameSnapshot,
          bodySnippet: r.bodySnippet,
        };
      }
    }
    if (mentions.length === 0 && quoteRefs.length === 0 && !replyTo) {
      return null;
    }
    return { mentions, quoteRefs, replyTo };
  } catch {
    return null;
  }
}

export type DirectorySyncTrace = {
  at: string;
  currentUserId: string;
  meshSecretConfigured: boolean;
  lanInstanceId: string;
  peerCount: number;
  meshUserPull: Array<{
    peer: string;
    ok: boolean;
    remoteUserCount?: number;
    error?: string;
  }>;
  presencePull: Array<{ peer: string; ok: boolean; error?: string; count?: number }>;
  mergedRowsFromMesh: number;
  totalActiveUsersInDbAfterMerge: number;
  directoryRowCount: number;
  presentEmailCount: number;
  directoryEmails: string[];
  /** Activos en BD excl. yo, antes de sync mesh (diagnóstico). */
  activeOthersBeforeMeshSync: number;
  /** Suma de filas devueltas por peers (solo pulls ok). */
  meshRemoteUsersTotal: number;
  /** Emails únicos tras deduplicar merge (mapa previo a upsert). */
  meshInMapAfterDedupe: number;
  meshSkippedNoEmail: number;
  /** Existe en mapa pero no en BD y no hay password usable → no se crea fila. */
  meshCreateSkippedNoPassword: number;
  meshUpsertErrors: number;
  /** Descubrimiento LAN: peers iniciales antes del probe. */
  peerCountInitial: number;
  /** Descubrimiento LAN: peers finales al construir la lista de fetch. */
  peerCountFinal: number;
  /** Iteraciones del polling antes de armar la lista de peers para mesh. */
  peerWaitIterations: number;
  /** Si el polling expiró sin peers estables. */
  peerWaitTimedOut: boolean;

  /** Dedupe mesh: cuántas veces vimos un email repetido en múltiples peers. */
  meshDuplicateEmailCount: number;

  /** Emails descartados por no poder crear (sin password válido). */
  meshCreateWithoutPasswordEmails: string[];

  /** Emails donde falló el upsert/actualización mesh. */
  meshUpsertErrorEmails: string[];

  /**
   * Eventos de descarte por fila en el merge mesh (limitados, para no inundar logs).
   * reason: 'no_email' | 'duplicate_email' | 'create_without_password' | 'upsert_error'
   */
  meshRowDiscardEvents: Array<{
    reason: string;
    peer?: string;
    email?: string | null;
    emailKind?: "null" | "empty_string" | "undefined" | "non_string" | "other";
    emailType?: string;
    remoteId?: string | null;
    remoteName?: string | null;
    remoteFullName?: string | null;
    // value solo para evidencia (primitivos). Si no es primitivo, se omite.
    emailValueSample?: string | null;
  }>;

  /** Agregado: cuántas veces vimos email inválido por tipo en peers. */
  meshNoEmailByKind: Array<{ kind: string; count: number }>;

  /** Ejemplos (limitados) de filas descartadas por email inválido. */
  meshNoEmailSamples: Array<{
    peer?: string;
    emailKind?: string;
    emailType?: string;
    remoteId?: string | null;
    remoteName?: string | null;
    remoteFullName?: string | null;
    emailValueSample?: string | null;
  }>;
};

@Injectable()
export class ConversationsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConversationsService.name);
  /** Última traza de directorio (para GET directory-diagnostics y logs). */
  private lastDirectoryTraceByUser = new Map<string, DirectorySyncTrace>();
  private warnedMeshSecretMissing = false;
  private p2pRetryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationsGateway: ConversationsGateway,
    private readonly conversationPresence: ConversationPresenceService,
    private readonly lanDiscovery: LanDiscoveryService,
    private readonly lanP2pBridge: LanP2pBridgeService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  private storageKeyForCompany(companyId: string, key: string): string {
    const safeCompany = String(companyId || "").trim() || "company_default";
    const safeKey = String(key || "").replace(/^\/+/, "").replace(/\\/g, "/");
    return `${safeCompany}/${safeKey}`;
  }

  onModuleInit(): void {
    if (this.lanP2pBridge.isEnabled()) {
      this.p2pRetryTimer = setInterval(() => {
        void this.retryP2pQueuedDeliveries();
      }, 12_000);
    }
  }

  onModuleDestroy(): void {
    if (this.p2pRetryTimer) {
      clearInterval(this.p2pRetryTimer);
      this.p2pRetryTimer = null;
    }
  }

  private getLocalPvqInstallationId(): string {
    const v = (process.env.PVQ_INSTALLATION_ID ?? "").trim();
    return v.length > 0 ? v : "nest-dev";
  }

  private async resolveBestPeerIdentity(userId: string): Promise<{
    peerId: string;
    installationId: string;
    lastSeenAt: Date;
  } | null> {
    const peer = await this.prisma.userP2pIdentity.findFirst({
      where: { userId, peerId: { not: "" } },
      orderBy: { lastSeenAt: "desc" },
      select: { peerId: true, installationId: true, lastSeenAt: true },
    });
    if (!peer?.peerId) return null;
    return peer;
  }

  private lanMeshSecret(): string | null {
    const s = (process.env.LAN_MESH_SECRET ?? "").trim();
    return s.length >= 8 ? s : null;
  }

  async generateEntityPdfBuffer(
    entityType: "PRODUCT" | "SUPPLIER" | "CLIENT" | "FV_STUDY" | "QUOTE" | "QUOTE_TEMPLATE",
    title: string,
    summary?: Record<string, unknown>,
  ): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4 portrait
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
    page.drawText("Entidad compartida", {
      x: 48,
      y,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 24;
    page.drawText(title.trim() || "Sin titulo", {
      x: 48,
      y,
      size: 18,
      font: bold,
      color: rgb(0.08, 0.08, 0.08),
    });
    y -= 24;
    page.drawText(`Tipo: ${entityType}`, {
      x: 48,
      y,
      size: 11,
      font: regular,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 26;
    if (summary) {
      const rows = Object.entries(summary).slice(0, 24);
      for (const [k, v] of rows) {
        const line = `${k}: ${v == null ? "—" : String(v)}`;
        if (y < 58) break;
        page.drawText(line.slice(0, 140), {
          x: 48,
          y,
          size: 10,
          font: regular,
          color: rgb(0.18, 0.18, 0.18),
        });
        y -= 16;
      }
    }
    page.drawText(`Generado: ${new Date().toLocaleString("es-ES")}`, {
      x: 48,
      y: 36,
      size: 9,
      font: regular,
      color: rgb(0.45, 0.45, 0.45),
    });
    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  private meshPeerBaseUrl(address: string, apiPort: number): string {
    const host =
      address.includes(":") && !/^\d{1,3}(\.\d{1,3}){3}$/.test(address)
        ? `[${address}]`
        : address;
    return `http://${host}:${apiPort}/api`;
  }

  /**
   * Descarga listas de usuarios de todos los peers en paralelo; aplica upserts en SQLite en serie
   * (evita "database locked" y lista incompleta por debounce omitido).
   */
  private async syncLanMeshUsersFromPeers(): Promise<{
    meshUserPull: DirectorySyncTrace["meshUserPull"];
    mergedRows: number;
    meshRemoteUsersTotal: number;
    meshInMapAfterDedupe: number;
    meshSkippedNoEmail: number;
    meshCreateSkippedNoPassword: number;
    meshUpsertErrors: number;
    peerCountInitial: number;
    peerCountFinal: number;
    peerWaitIterations: number;
    peerWaitTimedOut: boolean;
    meshDuplicateEmailCount: number;
    meshCreateWithoutPasswordEmails: string[];
    meshUpsertErrorEmails: string[];
    meshRowDiscardEvents: DirectorySyncTrace["meshRowDiscardEvents"];
    meshNoEmailByKind: DirectorySyncTrace["meshNoEmailByKind"];
    meshNoEmailSamples: DirectorySyncTrace["meshNoEmailSamples"];
  }> {
    const meshUserPull: DirectorySyncTrace["meshUserPull"] = [];
    const emptyDiag = {
      meshRemoteUsersTotal: 0,
      meshInMapAfterDedupe: 0,
      meshSkippedNoEmail: 0,
      meshCreateSkippedNoPassword: 0,
      meshUpsertErrors: 0,
      peerCountInitial: 0,
      peerCountFinal: 0,
      peerWaitIterations: 0,
      peerWaitTimedOut: false,
      meshDuplicateEmailCount: 0,
      meshCreateWithoutPasswordEmails: [],
      meshUpsertErrorEmails: [],
      meshRowDiscardEvents: [],
      meshNoEmailByKind: [],
      meshNoEmailSamples: [],
    };
    const secret = this.lanMeshSecret();
    if (!secret) {
      return { meshUserPull, mergedRows: 0, ...emptyDiag };
    }

    const peerCountInitial = this.lanDiscovery.getStatus().peerCount;
    this.lanDiscovery.triggerDiscoveryProbe();

    // Polling determinista para evitar leer la lista de peers incompleta en el mismo tick.
    const sleepMs = 200;
    const deadlineMs = Date.now() + 3000;
    let peerWaitIterations = 0;
    let peerWaitTimedOut = false;

    let peerCountPrev = this.lanDiscovery.getStatus().peerCount;
    let peerCountFinal = peerCountPrev;
    let peersSnapshot = [...this.lanDiscovery.getStatus().peers];

    while (true) {
      const st = this.lanDiscovery.getStatus();
      peerCountFinal = st.peerCount;
      peersSnapshot = [...st.peers];

      // Salida 1: peers ya disponibles.
      if (peersSnapshot.length > 0) break;

      // Salida 2: peerCount se estabilizó (dos lecturas consecutivas iguales) y ya no es 0.
      if (peerCountFinal === peerCountPrev && peerCountFinal > 0) break;

      if (Date.now() >= deadlineMs) {
        peerWaitTimedOut = true;
        break;
      }

      peerWaitIterations += 1;
      peerCountPrev = peerCountFinal;
      await new Promise((r) => setTimeout(r, sleepMs));
    }

    const peers = peersSnapshot.sort((a, b) =>
      `${a.address}:${a.apiPort}`.localeCompare(`${b.address}:${b.apiPort}`, "en"),
    );

    // Descates del merge mesh (limitado a N eventos para no inundar logs/trace).
    const maxRowDiscardEvents = 200;
    let meshDuplicateEmailCount = 0;
    const meshCreateWithoutPasswordEmailsSet = new Set<string>();
    const meshUpsertErrorEmailsSet = new Set<string>();
    const meshCreateWithoutPasswordEmails: string[] = [];
    const meshUpsertErrorEmails: string[] = [];
    const meshRowDiscardEvents: DirectorySyncTrace["meshRowDiscardEvents"] = [];
    const pushDiscardEvent = (evt: DirectorySyncTrace["meshRowDiscardEvents"][number]) => {
      if (meshRowDiscardEvents.length >= maxRowDiscardEvents) return;
      meshRowDiscardEvents.push(evt);
    };

    const fetchResults = await Promise.all(
      peers.map(async (p) => {
        const peerKey = `${p.address}:${p.apiPort}`;
        const base = this.meshPeerBaseUrl(p.address, p.apiPort);
        const url = `${base}/lan/mesh/users`;
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), LAN_MESH_FETCH_MS);
        try {
          const res = await fetch(url, {
            signal: ac.signal,
            headers: { "X-Lan-Mesh-Secret": secret },
          });
          clearTimeout(to);
          if (!res.ok) {
            return {
              peerKey,
              ok: false as const,
              error: `HTTP ${res.status}`,
              users: [] as MeshUserRow[],
            };
          }
          const data = (await res.json()) as { users?: MeshUserRow[] };
          const users = data.users ?? [];
          return { peerKey, ok: true as const, users };
        } catch (e) {
          clearTimeout(to);
          return {
            peerKey,
            ok: false as const,
            error: e instanceof Error ? e.message : String(e),
            users: [] as MeshUserRow[],
          };
        }
      }),
    );

    let meshRemoteUsersTotal = 0;
    let meshSkippedNoEmail = 0;
    const byEmail = new Map<string, MeshUserRow>();
    const meshNoEmailByKindMap = new Map<string, number>();
    const meshNoEmailSamples: DirectorySyncTrace["meshNoEmailSamples"] = [];
    const maxNoEmailSamples = 50;
    const bumpNoEmailKind = (kind: string) => {
      meshNoEmailByKindMap.set(kind, (meshNoEmailByKindMap.get(kind) ?? 0) + 1);
    };
    for (const fr of fetchResults) {
      if (fr.ok) {
        meshRemoteUsersTotal += fr.users.length;
        meshUserPull.push({
          peer: fr.peerKey,
          ok: true,
          remoteUserCount: fr.users.length,
        });
        for (const u of fr.users) {
          const emailField = (u as MeshUserRow).email as unknown;
          let emailKind: DirectorySyncTrace["meshRowDiscardEvents"][number]["emailKind"] = "other";
          let emailType = typeof emailField;
          let emailValueSample: string | null = null;

          if (emailField === null) {
            emailKind = "null";
            emailValueSample = null;
          } else if (emailField === undefined) {
            emailKind = "undefined";
            emailValueSample = null;
          } else if (typeof emailField !== "string") {
            emailKind = "non_string";
            emailValueSample = String(emailField);
          } else {
            const trimmed = emailField.trim();
            if (!trimmed) {
              emailKind = "empty_string";
              emailValueSample = "";
            } else {
              const email = trimmed.toLowerCase();
              const prev = byEmail.get(email);
              // Dedupe por email: cuenta duplicados (para evidencia).
              if (prev) {
                meshDuplicateEmailCount += 1;
                pushDiscardEvent({
                  reason: "duplicate_email",
                  peer: fr.peerKey,
                  email,
                });
              }
              byEmail.set(email, mergeMeshUserRows(prev, u, email));
              continue;
            }
          }

          // Descarta solo después de dejar evidencia.
          meshSkippedNoEmail += 1;
          bumpNoEmailKind(String(emailKind));
          const remoteId = typeof u.id === "string" ? u.id : null;
          const remoteName = typeof u.name === "string" ? u.name : null;
          const remoteFullName = typeof u.fullName === "string" ? u.fullName : null;

          if (meshNoEmailSamples.length < maxNoEmailSamples) {
            meshNoEmailSamples.push({
              peer: fr.peerKey,
              emailKind: emailKind,
              emailType,
              remoteId,
              remoteName,
              remoteFullName,
              emailValueSample,
            });
          }

          pushDiscardEvent({
            reason: "no_email",
            peer: fr.peerKey,
            email: null,
            emailKind,
            emailType,
            remoteId,
            remoteName,
            remoteFullName,
            emailValueSample,
          });
          continue;
        }
      } else {
        meshUserPull.push({
          peer: fr.peerKey,
          ok: false,
          error: fr.error,
        });
      }
    }

    let mergedRows = 0;
    let meshCreateSkippedNoPassword = 0;
    let meshUpsertErrors = 0;
    for (const [email, u] of byEmail) {
      const emailRaw = typeof u.email === "string" ? u.email.trim() : email;
      try {
        let existingId: string | null = null;
        const rows = await this.prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM "User" WHERE lower("email") = lower(${emailRaw}) LIMIT 1`,
        );
        existingId = rows[0]?.id ?? null;

        if (existingId) {
          await this.prisma.user.update({
            where: { id: existingId },
            data: {
              email,
              name: u.name ?? undefined,
              fullName: u.fullName ?? undefined,
              active: true,
            },
          });
          mergedRows += 1;
          continue;
        }

        if (!meshPasswordOkForCreate(u.password)) {
          meshCreateSkippedNoPassword += 1;
          if (!meshCreateWithoutPasswordEmailsSet.has(email)) {
            meshCreateWithoutPasswordEmailsSet.add(email);
            meshCreateWithoutPasswordEmails.push(email);
          }
          pushDiscardEvent({
            reason: "create_without_password",
            email,
            peer: undefined,
          });
          continue;
        }

        await this.prisma.user.create({
          data: {
            email,
            password: u.password,
            name: u.name ?? null,
            fullName: u.fullName ?? null,
            active: true,
            companyId: "company_default",
          },
        });
        mergedRows += 1;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const rows = await this.prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM "User" WHERE lower("email") = lower(${emailRaw}) LIMIT 1`,
          );
          const id = rows[0]?.id;
          if (id) {
            try {
              await this.prisma.user.update({
                where: { id },
                data: {
                  email,
                  name: u.name ?? undefined,
                  fullName: u.fullName ?? undefined,
                  active: true,
                },
              });
              mergedRows += 1;
            } catch (e2) {
              meshUpsertErrors += 1;
              if (!meshUpsertErrorEmailsSet.has(email)) {
                meshUpsertErrorEmailsSet.add(email);
                meshUpsertErrorEmails.push(email);
              }
              pushDiscardEvent({
                reason: "upsert_error",
                email,
              });
              this.log.warn(`mesh upsert omitido ${email}: ${e2 instanceof Error ? e2.message : e2}`);
            }
          } else {
            meshUpsertErrors += 1;
            if (!meshUpsertErrorEmailsSet.has(email)) {
              meshUpsertErrorEmailsSet.add(email);
              meshUpsertErrorEmails.push(email);
            }
            pushDiscardEvent({
              reason: "upsert_error",
              email,
            });
            this.log.warn(`mesh P2002 sin fila ${email}: ${e.message}`);
          }
        } else {
          meshUpsertErrors += 1;
          if (!meshUpsertErrorEmailsSet.has(email)) {
            meshUpsertErrorEmailsSet.add(email);
            meshUpsertErrorEmails.push(email);
          }
          pushDiscardEvent({
            reason: "upsert_error",
            email,
          });
          this.log.warn(`mesh upsert omitido ${email}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    return {
      meshUserPull,
      mergedRows,
      meshRemoteUsersTotal,
      meshInMapAfterDedupe: byEmail.size,
      meshSkippedNoEmail,
      meshCreateSkippedNoPassword,
      meshUpsertErrors,
      peerCountInitial,
      peerCountFinal,
      peerWaitIterations,
      peerWaitTimedOut,
      meshDuplicateEmailCount,
      meshCreateWithoutPasswordEmails,
      meshUpsertErrorEmails,
      meshRowDiscardEvents,
      meshNoEmailByKind: [...meshNoEmailByKindMap.entries()].map(([kind, count]) => ({
        kind,
        count,
      })),
      meshNoEmailSamples,
    };
  }

  private async collectLanOnlineEmails(): Promise<{
    online: Set<string>;
    presencePull: Array<{ peer: string; ok: boolean; error?: string; count?: number }>;
  }> {
    const online = new Set<string>();
    const presencePull: Array<{
      peer: string;
      ok: boolean;
      error?: string;
      count?: number;
    }> = [];

    const presentIds = this.conversationPresence.getPresentUserIds();
    if (presentIds.length > 0) {
      const rows = await this.prisma.user.findMany({
        where: { id: { in: presentIds } },
        select: { email: true },
      });
      for (const r of rows) {
        online.add(r.email.trim().toLowerCase());
      }
    }

    const secret = this.lanMeshSecret();
    if (!secret) {
      return { online, presencePull };
    }

    this.lanDiscovery.triggerDiscoveryProbe();
    const peers = [...this.lanDiscovery.getStatus().peers].sort((a, b) =>
      `${a.address}:${a.apiPort}`.localeCompare(`${b.address}:${b.apiPort}`, "en"),
    );

    const results = await Promise.all(
      peers.map(async (p) => {
        const peerKey = `${p.address}:${p.apiPort}`;
        const base = this.meshPeerBaseUrl(p.address, p.apiPort);
        const url = `${base}/lan/mesh/presence`;
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), LAN_MESH_FETCH_MS);
        try {
          const res = await fetch(url, {
            signal: ac.signal,
            headers: { "X-Lan-Mesh-Secret": secret },
          });
          clearTimeout(to);
          if (!res.ok) {
            return { peerKey, ok: false as const, error: `HTTP ${res.status}` };
          }
          const j = (await res.json()) as { onlineEmails?: string[] };
          const list = (j.onlineEmails ?? []).filter(
            (e): e is string => typeof e === "string" && e.trim() !== "",
          );
          return { peerKey, ok: true as const, list };
        } catch (e) {
          clearTimeout(to);
          return {
            peerKey,
            ok: false as const,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    for (const r of results) {
      if (r.ok && "list" in r) {
        for (const e of r.list) {
          online.add(e.trim().toLowerCase());
        }
        presencePull.push({ peer: r.peerKey, ok: true, count: r.list.length });
      } else {
        presencePull.push({
          peer: r.peerKey,
          ok: false,
          error: "error" in r ? r.error : undefined,
        });
      }
    }

    return { online, presencePull };
  }

  async listDirectoryUsers(currentUserId: string, opts?: { presentOnly?: boolean }) {
    const lanStatus = this.lanDiscovery.getStatus();
    if (
      !this.warnedMeshSecretMissing &&
      this.lanMeshSecret() == null &&
      lanStatus.peerCount > 0
    ) {
      this.warnedMeshSecretMissing = true;
      this.log.warn(
        "PV_CONV_MESH: hay otros nodos en LAN pero LAN_MESH_SECRET no está definido (≥8 caracteres). " +
          "Sin él el directorio solo muestra usuarios de esta base de datos.",
      );
    }

    const activeOthersBeforeMeshSync = await this.prisma.user.count({
      where: { active: true, id: { not: currentUserId } },
    });

    const {
      meshUserPull,
      mergedRows,
      meshRemoteUsersTotal,
      meshInMapAfterDedupe,
      meshSkippedNoEmail,
      meshCreateSkippedNoPassword,
      meshUpsertErrors,
      peerCountInitial,
      peerCountFinal,
      peerWaitIterations,
      peerWaitTimedOut,
      meshDuplicateEmailCount,
      meshCreateWithoutPasswordEmails,
      meshUpsertErrorEmails,
      meshRowDiscardEvents,
      meshNoEmailByKind,
      meshNoEmailSamples,
    } = await this.syncLanMeshUsersFromPeers();
    const { online: onlineEmails, presencePull } = await this.collectLanOnlineEmails();

    const totalActive = await this.prisma.user.count({ where: { active: true } });

    const users = await this.prisma.user.findMany({
      where: { active: true, id: { not: currentUserId } },
      select: {
        id: true,
        email: true,
        name: true,
        fullName: true,
        p2pIdentities: {
          orderBy: { lastSeenAt: "desc" },
          take: 1,
          select: { lastSeenAt: true },
        },
      },
      orderBy: { email: "asc" },
    });

    const allUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.fullName ?? u.name ?? u.email,
      present:
        this.conversationPresence.isUserPresent(u.id) ||
        onlineEmails.has(u.email.trim().toLowerCase()),
      presenceStatus:
        this.conversationPresence.isUserPresent(u.id) ||
        onlineEmails.has(u.email.trim().toLowerCase())
          ? "online"
          : "offline",
      lastSeenAt: u.p2pIdentities[0]?.lastSeenAt?.toISOString() ?? null,
    }));
    const filteredUsers = opts?.presentOnly
      ? allUsers.filter((u) => u.present)
      : allUsers;
    const out = {
      users: filteredUsers,
    };

    const trace: DirectorySyncTrace = {
      at: new Date().toISOString(),
      currentUserId,
      meshSecretConfigured: this.lanMeshSecret() != null,
      lanInstanceId: lanStatus.instanceId,
      peerCount: lanStatus.peerCount,
      meshUserPull,
      presencePull,
      mergedRowsFromMesh: mergedRows,
      totalActiveUsersInDbAfterMerge: totalActive,
      directoryRowCount: out.users.length,
      presentEmailCount: onlineEmails.size,
      directoryEmails: users.map((u) => u.email.trim().toLowerCase()),
      activeOthersBeforeMeshSync,
      meshRemoteUsersTotal,
      meshInMapAfterDedupe,
      meshSkippedNoEmail,
      meshCreateSkippedNoPassword,
      meshUpsertErrors,
      peerCountInitial,
      peerCountFinal,
      peerWaitIterations,
      peerWaitTimedOut,
      meshDuplicateEmailCount,
      meshCreateWithoutPasswordEmails,
      meshUpsertErrorEmails,
      meshRowDiscardEvents,
      meshNoEmailByKind,
      meshNoEmailSamples,
    };
    this.lastDirectoryTraceByUser.set(currentUserId, trace);

    this.log.log(
      JSON.stringify({
        pvConvDirectory: true,
        currentUserId,
        lanInstanceId: trace.lanInstanceId,
        meshSecretConfigured: trace.meshSecretConfigured,
        peerCount: trace.peerCount,
        meshUserPull: trace.meshUserPull,
        mergedRowsFromMesh: mergedRows,
        meshRemoteUsersTotal,
        meshInMapAfterDedupe,
        meshSkippedNoEmail,
        meshCreateSkippedNoPassword,
        meshUpsertErrors,
        activeOthersBeforeMeshSync,
        totalActiveUsersInDb: totalActive,
        directoryRowCount: out.users.length,
        presentEmailCount: onlineEmails.size,
        directoryNames: out.users.map((u) => u.name),
        directoryEmails: trace.directoryEmails,
        presencePull,
        peerCountInitial: trace.peerCountInitial,
        peerCountFinal: trace.peerCountFinal,
        peerWaitIterations: trace.peerWaitIterations,
        peerWaitTimedOut: trace.peerWaitTimedOut,
        meshDuplicateEmailCount: trace.meshDuplicateEmailCount,
        meshCreateSkippedNoPasswordEmails: trace.meshCreateWithoutPasswordEmails,
        meshUpsertErrorEmails: trace.meshUpsertErrorEmails,
        meshRowDiscardEvents: trace.meshRowDiscardEvents,
        meshNoEmailByKind: trace.meshNoEmailByKind,
        meshNoEmailSamples: trace.meshNoEmailSamples,
      }),
    );

    return out;
  }

  /** Diagnóstico para soporte (misma auth que el resto de conversaciones). */
  getLastDirectoryTraceForUser(userId: string): DirectorySyncTrace | null {
    return this.lastDirectoryTraceByUser.get(userId) ?? null;
  }

  async findExistingDirectConversation(userIdA: string, userIdB: string) {
    const convs = await this.prisma.conversation.findMany({
      where: {
        type: "DIRECT",
        AND: [
          { members: { some: { userId: userIdA, leftAt: null } } },
          { members: { some: { userId: userIdB, leftAt: null } } },
        ],
      },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, email: true, name: true, fullName: true },
            },
          },
        },
        createdBy: {
          select: { id: true, email: true, name: true, fullName: true },
        },
      },
    });
    const two = convs.find((c) => c.members.length === 2);
    return two ?? null;
  }

  async createConversation(dto: CreateConversationDto, createdById: string) {
    const ids = [
      ...new Set(dto.memberUserIds.map((x) => x.trim()).filter(Boolean)),
    ];
    if (dto.type === "DIRECT") {
      if (ids.length !== 1) {
        throw new BadRequestException(
          "Conversación directa: indique exactamente un otro usuario en memberUserIds",
        );
      }
      if (ids[0] === createdById) {
        throw new BadRequestException("No puede conversar consigo mismo");
      }
      const existing = await this.findExistingDirectConversation(
        createdById,
        ids[0],
      );
      if (existing) {
        await this.prisma.conversationMember.updateMany({
          where: {
            conversationId: existing.id,
            userId: createdById,
            leftAt: null,
          },
          data: { archivedAt: null },
        });
        return this.mapConversationDetail(existing.id, createdById);
      }
    } else {
      if (!dto.title?.trim()) {
        throw new BadRequestException("El título del grupo es obligatorio");
      }
      if (ids.length < 1) {
        throw new BadRequestException(
          "Grupo: indique al menos un miembro además de usted en memberUserIds",
        );
      }
    }
    const allMemberIds = [...new Set([createdById, ...ids])];
    for (const uid of allMemberIds) {
      if (uid === createdById) {
        continue;
      }
      const u = await this.prisma.user.findFirst({
        where: { id: uid, active: true },
      });
      if (!u) {
        throw new BadRequestException(
          `Usuario no encontrado o inactivo: ${uid}`,
        );
      }
    }
    const conv = await this.prisma.conversation.create({
      data: {
        type: dto.type,
        title: dto.type === "GROUP" ? dto.title!.trim() : null,
        createdById,
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            lastReadAt: null,
          })),
        },
      },
    });
    return this.mapConversationDetail(conv.id, createdById);
  }

  async listForUser(
    userId: string,
    opts?: { includeArchived?: boolean },
  ) {
    const includeArchived = opts?.includeArchived === true;
    const memberships = await this.prisma.conversationMember.findMany({
      where: {
        userId,
        leftAt: null,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      include: {
        conversation: {
          include: {
            members: {
              where: { leftAt: null },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    fullName: true,
                    p2pIdentities: {
                      orderBy: { lastSeenAt: "desc" },
                      take: 1,
                      select: { lastSeenAt: true },
                    },
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                author: {
                  select: { id: true, fullName: true, name: true, email: true },
                },
              },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });
    const out: Array<{
      id: string;
      type: string;
      title: string;
      rawTitle: string | null;
      updatedAt: string;
      unreadCount: number;
      /** ISO; null si esta conversación no está archivada para este usuario. */
      archivedAtForMe: string | null;
      /** Solo DIRECT: el otro usuario. Null en grupos. */
      directPeerUserId: string | null;
      /** Solo DIRECT: presencia del otro usuario en este instante. */
      present: boolean | null;
      presenceStatus: "online" | "offline" | null;
      /** Solo DIRECT/OFFLINE: último visto del otro usuario. */
      lastSeenAt: string | null;
      lastMessage: {
        id: string;
        body: string;
        createdAt: string;
        authorId: string;
        authorName: string;
      } | null;
    }> = [];
    for (const m of memberships) {
      const c = m.conversation;
      const unread = await this.unreadCount(c.id, userId, m.lastReadAt);
      const last = c.messages[0] ?? null;
      let directPeerUserId: string | null = null;
      let present: boolean | null = null;
      let presenceStatus: "online" | "offline" | null = null;
      let lastSeenAt: string | null = null;
      if (c.type === "DIRECT") {
        const other = c.members.find((x) => x.userId !== userId);
        directPeerUserId = other?.userId ?? null;
        if (other?.user) {
          const online = this.conversationPresence.isUserPresent(other.user.id);
          present = online;
          presenceStatus = online ? "online" : "offline";
          lastSeenAt = other.user.p2pIdentities?.[0]?.lastSeenAt?.toISOString() ?? null;
        }
      }
      out.push({
        id: c.id,
        type: c.type,
        title: this.displayTitle(c, userId),
        rawTitle: c.title,
        updatedAt: c.updatedAt.toISOString(),
        unreadCount: unread,
        archivedAtForMe: m.archivedAt?.toISOString() ?? null,
        directPeerUserId,
        present,
        presenceStatus,
        lastSeenAt,
        lastMessage: last
          ? {
              id: last.id,
              body:
                last.body.length > 120
                  ? `${last.body.slice(0, 117)}...`
                  : last.body,
              createdAt: last.createdAt.toISOString(),
              authorId: last.authorId,
              authorName:
                last.author.fullName ??
                last.author.name ??
                last.author.email,
            }
          : null,
      });
    }
    if (includeArchived) {
      out.sort((a, b) => {
        const aArch = a.archivedAtForMe != null;
        const bArch = b.archivedAtForMe != null;
        if (aArch !== bArch) {
          return aArch ? 1 : -1;
        }
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    }
    return { conversations: out };
  }

  displayTitle(
    c: {
      type: string;
      title: string | null;
      members: Array<{
        userId: string;
        user: {
          fullName: string | null;
          name: string | null;
          email: string;
        };
      }>;
    },
    currentUserId: string,
  ) {
    if (c.type === "GROUP") {
      return c.title ?? "Grupo";
    }
    const other = c.members.find((x) => x.userId !== currentUserId);
    if (!other) {
      return "Conversación";
    }
    const u = other.user;
    return u.fullName ?? u.name ?? u.email;
  }

  async unreadCount(
    conversationId: string,
    userId: string,
    lastReadAt: Date | null,
  ) {
    return this.prisma.message.count({
      where: {
        conversationId,
        authorId: { not: userId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
  }

  async getOne(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    return this.mapConversationDetail(conversationId, userId);
  }

  async mapConversationDetail(conversationId: string, currentUserId: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, email: true, name: true, fullName: true },
            },
          },
        },
        createdBy: {
          select: { id: true, email: true, name: true, fullName: true },
        },
      },
    });
    if (!c) {
      throw new NotFoundException("Conversación no encontrada");
    }
    const membership = c.members.find((m) => m.userId === currentUserId);
    if (!membership) {
      throw new ForbiddenException("No pertenece a esta conversación");
    }
    const unread = await this.unreadCount(
      c.id,
      currentUserId,
      membership.lastReadAt,
    );
    return {
      id: c.id,
      type: c.type,
      title: this.displayTitle(
        {
          type: c.type,
          title: c.title,
          members: c.members,
        },
        currentUserId,
      ),
      rawTitle: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      unreadCount: unread,
      archivedForMe: membership.archivedAt != null,
      members: c.members.map((m) => ({
        userId: m.userId,
        joinedAt: m.joinedAt.toISOString(),
        lastReadAt: m.lastReadAt?.toISOString() ?? null,
        archivedAt: m.archivedAt?.toISOString() ?? null,
        user: {
          id: m.user.id,
          email: m.user.email,
          name: m.user.fullName ?? m.user.name ?? m.user.email,
        },
      })),
    };
  }

  async archiveForUser(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    const at = new Date();
    await this.prisma.conversationMember.updateMany({
      where: { conversationId, userId, leftAt: null },
      data: { archivedAt: at },
    });
    return { ok: true, archivedAt: at.toISOString() };
  }

  async unarchiveForUser(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    await this.prisma.conversationMember.updateMany({
      where: { conversationId, userId, leftAt: null },
      data: { archivedAt: null },
    });
    return { ok: true };
  }

  async getMessages(
    conversationId: string,
    userId: string,
    query: { limit?: number; before?: string },
  ) {
    await this.assertMember(conversationId, userId);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const fetchRows = async (
      whereExtra: Record<string, unknown>,
      order: "recent" | "older",
    ) => {
      if (order === "recent") {
        return this.prisma.message.findMany({
          where: { conversationId, ...whereExtra },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            author: {
              select: { id: true, email: true, name: true, fullName: true },
            },
            sharedEntity: {
              include: {
                message: {
                  select: {
                    importDecisions: {
                      where: { receiverUserId: userId },
                      select: {
                        receiverUserId: true,
                        status: true,
                        resolutionMode: true,
                        targetEntityId: true,
                        errorMessage: true,
                      },
                    },
                  },
                },
              },
            },
            reactions: {
              select: { emoji: true, userId: true },
            },
            attachments: {
              select: {
                id: true,
                originalFileName: true,
                mimeType: true,
                sizeBytes: true,
              },
            },
          },
        });
      }
      return this.prisma.message.findMany({
        where: { conversationId, ...whereExtra },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        include: {
          author: {
            select: { id: true, email: true, name: true, fullName: true },
          },
          sharedEntity: {
            include: {
              message: {
                select: {
                  importDecisions: {
                    where: { receiverUserId: userId },
                    select: {
                      receiverUserId: true,
                      status: true,
                      resolutionMode: true,
                      targetEntityId: true,
                      errorMessage: true,
                    },
                  },
                },
              },
            },
          },
          reactions: {
            select: { emoji: true, userId: true },
          },
          attachments: {
            select: {
              id: true,
              originalFileName: true,
              mimeType: true,
              sizeBytes: true,
            },
          },
        },
      });
    };
    let rows: Awaited<ReturnType<typeof fetchRows>>;
    if (!query.before) {
      rows = await fetchRows({}, "recent");
      rows.reverse();
    } else {
      const cursor = await this.prisma.message.findFirst({
        where: { id: query.before, conversationId },
      });
      if (!cursor) {
        throw new BadRequestException(
          "Mensaje cursor no encontrado en esta conversación",
        );
      }
      rows = await fetchRows(
        {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            {
              AND: [
                { createdAt: cursor.createdAt },
                { id: { lt: cursor.id } },
              ],
            },
          ],
        },
        "older",
      );
      rows.reverse();
    }
    return this.formatMessageList(rows, userId);
  }

  storedToApi(
    stored: StoredMetadata | null,
    displayNameByUserId: Map<string, string>,
  ) {
    if (
      !stored ||
      (stored.mentions.length === 0 &&
        stored.quoteRefs.length === 0 &&
        !stored.replyTo)
    ) {
      return null;
    }
    return {
      mentions: stored.mentions.map((uid) => ({
        userId: uid,
        displayName: displayNameByUserId.get(uid) ?? uid,
      })),
      quoteRefs: stored.quoteRefs,
      replyTo: stored.replyTo,
    };
  }

  private currentNodeName(): string {
    const envName =
      (process.env.PV_NODE_NAME ?? process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "").trim();
    return envName || "Nodo local";
  }

  private groupReactions(
    reactions: Array<{ emoji: string; userId: string }>,
    viewerUserId: string,
  ): ReactionGroupApi[] {
    const grouped = new Map<string, ReactionGroupApi>();
    for (const r of reactions) {
      const curr = grouped.get(r.emoji);
      if (!curr) {
        grouped.set(r.emoji, {
          emoji: r.emoji,
          count: 1,
          reactedByMe: r.userId === viewerUserId,
        });
      } else {
        curr.count += 1;
        if (r.userId === viewerUserId) curr.reactedByMe = true;
      }
    }
    return [...grouped.values()].sort((a, b) => a.emoji.localeCompare(b.emoji));
  }

  private sanitizeFileName(name: string): string {
    const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
    return base || "archivo";
  }

  private extFromOriginal(name: string): string {
    const ext = path.extname(name || "").toLowerCase();
    if (!ext || ext.length > 10) return "";
    return ext;
  }

  private toAttachmentApi(
    messageId: string,
    a: {
      id: string;
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
    },
  ): AttachmentApi {
    return {
      id: a.id,
      fileName: a.originalFileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      downloadUrl: `/api/conversations/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(a.id)}/download`,
    };
  }

  private buildSharedEntityApi(
    shared:
      | {
          entityType: string;
          sourceUserId: string;
          sourceUserName: string;
          sourceNodeName: string;
          sourceEntityId: string | null;
          snapshotJson: string;
          message: {
            importDecisions: Array<{
              receiverUserId: string;
              status: string;
              resolutionMode: string | null;
              targetEntityId: string | null;
              errorMessage: string | null;
            }>;
          };
        }
      | null
      | undefined,
    viewerUserId: string,
  ): SharedEntityApi | null {
    if (!shared) return null;
    let snapshot: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(shared.snapshotJson) as unknown;
      if (parsed && typeof parsed === "object") {
        snapshot = parsed as Record<string, unknown>;
      }
    } catch {
      snapshot = {};
    }
    const myDecision =
      shared.message.importDecisions.find((d) => d.receiverUserId === viewerUserId) ?? null;
    return {
      entityType: shared.entityType,
      sourceUserId: shared.sourceUserId,
      sourceUserName: shared.sourceUserName,
      sourceNodeName: shared.sourceNodeName,
      sourceEntityId: shared.sourceEntityId ?? null,
      snapshot,
      myStatus: (myDecision?.status as SharedEntityApi["myStatus"]) ?? null,
      myResolutionMode:
        (myDecision?.resolutionMode as SharedEntityApi["myResolutionMode"]) ?? null,
      myTargetEntityId: myDecision?.targetEntityId ?? null,
      myErrorMessage: myDecision?.errorMessage ?? null,
    };
  }

  async formatMessageList(
    messages: Array<{
      id: string;
      body: string;
      kind: string;
      createdAt: Date;
      authorId: string;
      metadataJson: string | null;
      sharedEntity:
        | {
            entityType: string;
            sourceUserId: string;
            sourceUserName: string;
            sourceNodeName: string;
            sourceEntityId: string | null;
            snapshotJson: string;
            message: {
              importDecisions: Array<{
                receiverUserId: string;
                status: string;
                resolutionMode: string | null;
                targetEntityId: string | null;
                errorMessage: string | null;
              }>;
            };
          }
        | null;
      reactions: Array<{ emoji: string; userId: string }>;
      attachments: Array<{
        id: string;
        originalFileName: string;
        mimeType: string;
        sizeBytes: number;
      }>;
      author: {
        fullName: string | null;
        name: string | null;
        email: string;
      };
    }>,
    viewerUserId: string,
  ) {
    const allMentionIds = new Set<string>();
    for (const m of messages) {
      const s = parseMetadataStored(m.metadataJson);
      s?.mentions.forEach((id) => allMentionIds.add(id));
    }
    const users =
      allMentionIds.size > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: [...allMentionIds] } },
            select: { id: true, fullName: true, name: true, email: true },
          })
        : [];
    const displayMap = new Map(
      users.map((u) => [u.id, u.fullName ?? u.name ?? u.email]),
    );
    return {
      messages: messages.map((m) => {
        const stored = parseMetadataStored(m.metadataJson);
        const metadata = this.storedToApi(stored, displayMap);
        return {
          id: m.id,
          body: m.body,
          kind: m.kind,
          createdAt: m.createdAt.toISOString(),
          authorId: m.authorId,
          authorName: m.author.fullName ?? m.author.name ?? m.author.email,
          metadata,
          sharedEntity: this.buildSharedEntityApi(m.sharedEntity, viewerUserId),
          reactions: this.groupReactions(m.reactions ?? [], viewerUserId),
          attachments: (m.attachments ?? []).map((a) =>
            this.toAttachmentApi(m.id, a),
          ),
        };
      }),
    };
  }

  async getMentionableMemberUserIds(conversationId: string) {
    const rows = await this.prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      include: {
        user: { select: { id: true, active: true } },
      },
    });
    const set = new Set<string>();
    for (const r of rows) {
      if (r.user.active) {
        set.add(r.userId);
      }
    }
    return set;
  }

  async createMessage(
    conversationId: string,
    authorId: string,
    dto: CreateMessageDto,
    authUser: AuthUserPayload,
  ) {
    await this.assertMember(conversationId, authorId);
    const trimmed = (dto.body ?? "").trim();
    const hasSharedEntity = !!dto.sharedEntity;
    if (!trimmed && !hasSharedEntity) {
      throw new BadRequestException("El mensaje no puede estar vacío");
    }
    if (trimmed.length > MAX_BODY) {
      throw new BadRequestException(
        `Mensaje demasiado largo (máx. ${MAX_BODY} caracteres)`,
      );
    }
    const mentionIds = [...new Set((dto.mentions ?? []).filter(Boolean))];
    const quoteIdList = [...new Set((dto.quoteIds ?? []).filter(Boolean))];
    let replyTo: StoredMetadata["replyTo"] = null;
    if (dto.replyToMessageId?.trim()) {
      const replyMessage = await this.prisma.message.findUnique({
        where: { id: dto.replyToMessageId.trim() },
        include: {
          author: { select: { fullName: true, name: true, email: true } },
        },
      });
      if (!replyMessage || replyMessage.conversationId !== conversationId) {
        throw new BadRequestException("El mensaje al que responde no existe en esta conversación.");
      }
      const snippetRaw = replyMessage.body.trim();
      replyTo = {
        messageId: replyMessage.id,
        authorNameSnapshot:
          replyMessage.author.fullName ??
          replyMessage.author.name ??
          replyMessage.author.email,
        bodySnippet:
          snippetRaw.length > 140 ? `${snippetRaw.slice(0, 137)}...` : snippetRaw,
      };
    }
    const memberIds = await this.getMentionableMemberUserIds(conversationId);
    for (const uid of mentionIds) {
      if (!memberIds.has(uid)) {
        throw new BadRequestException(
          "Las menciones indicadas no son válidas para esta conversación.",
        );
      }
    }
    const quoteRefs: StoredMetadata["quoteRefs"] = [];
    for (const quoteId of quoteIdList) {
      const quote = await this.prisma.quote.findUnique({
        where: { id: quoteId },
        select: {
          id: true,
          title: true,
          commercialNumber: true,
          quoteKind: true,
          ownerId: true,
          salespersonId: true,
          companyId: true,
        },
      });
      if (!quote || !canAccessQuote(authUser, quote)) {
        throw new BadRequestException(
          "No se pueden adjuntar una o más referencias solicitadas.",
        );
      }
      quoteRefs.push({
        quoteId: quote.id,
        titleSnapshot: quote.title,
        commercialNumberSnapshot: quote.commercialNumber ?? null,
      });
    }
    let metadataJson: string | null = null;
    if (mentionIds.length > 0 || quoteRefs.length > 0 || replyTo) {
      const payload = {
        mentions: mentionIds,
        quoteRefs,
        replyTo,
      };
      metadataJson = JSON.stringify(payload);
    }
    const conversationMembers = await this.prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    const receiverIds = conversationMembers
      .map((m) => m.userId)
      .filter((id) => id !== authorId);

    // Una sola sentencia con writes anidados: evita $transaction interactivo (timeout 5s con latencia Supabase).
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        authorId,
        body: trimmed,
        kind: hasSharedEntity ? "SHARED_ENTITY" : "TEXT",
        metadataJson,
        ...(dto.sharedEntity
          ? {
              sharedEntity: {
                create: {
                  entityType: dto.sharedEntity.entityType,
                  snapshotJson: JSON.stringify(dto.sharedEntity.snapshot),
                  proposedImportJson: JSON.stringify(dto.sharedEntity.proposedImport),
                  sourceEntityId: dto.sharedEntity.sourceEntityId?.trim() || null,
                  sourceUserId: authorId,
                  sourceUserName: authUser.fullName ?? authUser.name ?? authUser.email,
                  sourceNodeName: this.currentNodeName(),
                },
              },
              ...(receiverIds.length > 0
                ? {
                    importDecisions: {
                      createMany: {
                        data: receiverIds.map((receiverUserId) => ({
                          receiverUserId,
                          status: "PENDING",
                        })),
                      },
                    },
                  }
                : {}),
            }
          : {}),
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    const author = await this.prisma.user.findUniqueOrThrow({
      where: { id: authorId },
      select: { id: true, email: true, name: true, fullName: true },
    });
    const stored = parseMetadataStored(msg.metadataJson);
    const mentionIdsForEnrich = stored?.mentions.length
      ? [...new Set(stored.mentions)]
      : [];
    const mu =
      mentionIdsForEnrich.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: mentionIdsForEnrich } },
            select: { id: true, fullName: true, name: true, email: true },
          })
        : [];
    const displayMap = new Map(
      mu.map((u) => [u.id, u.fullName ?? u.name ?? u.email]),
    );
    const metadata = this.storedToApi(stored, displayMap);
    const out = {
      id: msg.id,
      body: msg.body,
      kind: msg.kind,
      createdAt: msg.createdAt.toISOString(),
      authorId: msg.authorId,
      authorName: author.fullName ?? author.name ?? author.email,
      metadata,
      sharedEntity: hasSharedEntity
        ? {
            entityType: dto.sharedEntity!.entityType,
            sourceUserId: authorId,
            sourceUserName: authUser.fullName ?? authUser.name ?? authUser.email,
            sourceNodeName: this.currentNodeName(),
            sourceEntityId: dto.sharedEntity!.sourceEntityId?.trim() || null,
            snapshot: dto.sharedEntity!.snapshot,
            myStatus: null,
            myResolutionMode: null,
            myTargetEntityId: null,
            myErrorMessage: null,
          }
        : null,
      reactions: [],
      attachments: [],
    };
    const membersForLog = await this.prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: {
        userId: true,
        user: { select: { email: true } },
      },
    });
    this.log.log(
      JSON.stringify({
        pvConvMessageSend: true,
        conversationId,
        messageId: out.id,
        authorId: out.authorId,
        authorEmail: author.email,
        saved: true,
        memberUserIds: membersForLog.map((m) => m.userId),
        memberEmails: membersForLog.map((m) => m.user.email.trim().toLowerCase()),
      }),
    );
    await this.conversationsGateway.emitMessageNew(conversationId, out);
    void this.forwardP2pAfterSave({
      conversationId,
      messageId: out.id,
      authorId,
      body: trimmed,
      receiverUserIds: receiverIds,
    }).catch((e) => this.log.warn(`P2P forward: ${e instanceof Error ? e.message : e}`));
    return out;
  }

  async markRead(conversationId: string, userId: string) {
    const m = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId, leftAt: null },
    });
    if (!m) {
      throw new ForbiddenException("No pertenece a esta conversación");
    }
    const lastMsg = await this.prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
    });
    const lastReadAt = lastMsg?.createdAt ?? new Date();
    await this.prisma.conversationMember.update({
      where: { id: m.id },
      data: { lastReadAt },
    });
    return { ok: true, lastReadAt: lastReadAt.toISOString() };
  }

  private async findDuplicateCandidates(
    entityType: string,
    snapshot: Record<string, unknown>,
    /** Si se informa, limita clientes / estudios / cotizaciones a la empresa del receptor (multi-tenant). */
    tenantCompanyId?: string | null,
  ): Promise<Array<{ id: string; label: string }>> {
    const safe = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const companyScope =
      typeof tenantCompanyId === "string" && tenantCompanyId.trim() !== ""
        ? { companyId: tenantCompanyId.trim() }
        : {};
    if (entityType === "PRODUCT") {
      const q = safe(snapshot.name);
      if (!q) return [];
      const rows = await this.prisma.product.findMany({
        where: { name: { contains: q } },
        select: { id: true, name: true },
        take: 8,
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    if (entityType === "SUPPLIER") {
      const q = safe(snapshot.name);
      if (!q) return [];
      const rows = await this.prisma.supplier.findMany({
        where: { name: { contains: q } },
        select: { id: true, name: true },
        take: 8,
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    if (entityType === "CLIENT") {
      const q = safe(snapshot.name);
      if (!q) return [];
      const rows = await this.prisma.client.findMany({
        where: { ...companyScope, name: { contains: q } },
        select: { id: true, name: true },
        take: 8,
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    if (entityType === "FV_STUDY") {
      const q = safe(snapshot.title);
      if (!q) return [];
      const rows = await this.prisma.fvStudy.findMany({
        where: { ...companyScope, title: { contains: q } },
        select: { id: true, title: true },
        take: 8,
      });
      return rows.map((r) => ({ id: r.id, label: r.title }));
    }
    if (entityType === "QUOTE") {
      const q = safe(snapshot.title);
      if (!q) return [];
      const rows = await this.prisma.quote.findMany({
        where: { ...companyScope, title: { contains: q } },
        select: { id: true, title: true, commercialNumber: true },
        take: 8,
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.commercialNumber ? `${r.title} (${r.commercialNumber})` : r.title,
      }));
    }
    if (entityType === "QUOTE_TEMPLATE") {
      const q = safe(snapshot.name);
      if (!q) return [];
      const rows = await this.prisma.quoteTemplate.findMany({
        where: { name: { contains: q } },
        select: { id: true, name: true },
        take: 8,
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    return [];
  }

  async resolveSharedEntityMessage(
    messageId: string,
    receiverUserId: string,
    dto: ResolveSharedEntityDto,
  ) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sharedEntity: true,
        conversation: { select: { id: true } },
      },
    });
    if (!msg || !msg.sharedEntity) {
      throw new NotFoundException("Mensaje compartido no encontrado.");
    }
    await this.assertMember(msg.conversationId, receiverUserId);
    const decision = await this.prisma.sharedEntityImportDecision.findUnique({
      where: { messageId_receiverUserId: { messageId, receiverUserId } },
    });
    if (!decision) {
      throw new ForbiddenException("Este mensaje no está pendiente para su usuario.");
    }
    let snapshot: Record<string, unknown> = {};
    let proposedImport: Record<string, unknown> = {};
    try {
      snapshot = JSON.parse(msg.sharedEntity.snapshotJson) as Record<string, unknown>;
      proposedImport = JSON.parse(msg.sharedEntity.proposedImportJson) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("Payload compartido inválido.");
    }
    if (dto.decision === "REJECT") {
      await this.prisma.sharedEntityImportDecision.update({
        where: { id: decision.id },
        data: {
          status: "REJECTED",
          resolutionMode: "REJECT",
          resolvedAt: new Date(),
          errorMessage: null,
        },
      });
      return { ok: true, status: "REJECTED" };
    }
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverUserId },
      select: { companyId: true },
    });
    const receiverCompanyId = receiver?.companyId?.trim() || null;
    const entityTypeRequiresTenant =
      msg.sharedEntity.entityType === "CLIENT" ||
      msg.sharedEntity.entityType === "FV_STUDY" ||
      msg.sharedEntity.entityType === "QUOTE";
    if (entityTypeRequiresTenant && !receiverCompanyId) {
      throw new BadRequestException("Usuario receptor sin empresa asignada.");
    }
    if (
      (dto.decision === "ACCEPT_USE_EXISTING" || dto.decision === "ACCEPT_LINK_EXISTING") &&
      !dto.existingEntityId?.trim()
    ) {
      const candidates = await this.findDuplicateCandidates(
        msg.sharedEntity.entityType,
        snapshot,
        receiverCompanyId,
      );
      throw new BadRequestException({
        message: "Debe seleccionar una entidad existente para esa opción.",
        mode: "MANUAL_RESOLUTION_REQUIRED",
        candidates,
        options: ["ACCEPT_USE_EXISTING", "ACCEPT_LINK_EXISTING", "ACCEPT_CREATE_NEW"],
      });
    }

    try {
      let targetEntityId: string | null = null;
      const mode =
        dto.decision === "ACCEPT_CREATE_NEW"
          ? "CREATE_NEW"
          : dto.decision === "ACCEPT_USE_EXISTING"
            ? "USE_EXISTING"
            : "LINK_EXISTING";

      if (dto.decision === "ACCEPT_CREATE_NEW") {
        if (msg.sharedEntity.entityType === "PRODUCT") {
          const created = await this.prisma.product.create({
            data: {
              name: String(proposedImport.name ?? snapshot.name ?? "Producto compartido"),
              categoryId: Number(proposedImport.categoryId ?? 1),
              unit: String(proposedImport.unit ?? "unidad"),
              description:
                proposedImport.description != null ? String(proposedImport.description) : null,
            },
            select: { id: true },
          });
          targetEntityId = created.id;
        } else if (msg.sharedEntity.entityType === "SUPPLIER") {
          const created = await this.prisma.supplier.create({
            data: {
              name: String(proposedImport.name ?? snapshot.name ?? "Proveedor compartido"),
              supplyOrigin: String(proposedImport.supplyOrigin ?? "NACIONAL"),
              actorType: String(proposedImport.actorType ?? "DISTRIBUIDOR"),
              email: proposedImport.email != null ? String(proposedImport.email) : null,
            },
            select: { id: true },
          });
          targetEntityId = created.id;
        } else if (msg.sharedEntity.entityType === "CLIENT") {
          const created = await this.prisma.client.create({
            data: {
              companyId: receiverCompanyId!,
              type: String(proposedImport.type ?? "EMPRESA"),
              name: String(proposedImport.name ?? snapshot.name ?? "Cliente compartido"),
              email: proposedImport.email != null ? String(proposedImport.email) : null,
            },
            select: { id: true },
          });
          targetEntityId = created.id;
        } else if (msg.sharedEntity.entityType === "FV_STUDY") {
          throw new BadRequestException(
            "En esta fase, estudios compartidos se aceptan por vinculación manual, no por creación directa.",
          );
        } else if (
          msg.sharedEntity.entityType === "QUOTE" ||
          msg.sharedEntity.entityType === "QUOTE_TEMPLATE"
        ) {
          throw new BadRequestException(
            "En esta fase, cotizaciones y plantillas compartidas se aceptan por vinculación manual, no por creación directa.",
          );
        }
      } else {
        const existingId = dto.existingEntityId!.trim();
        const et = msg.sharedEntity.entityType;
        if (et === "CLIENT") {
          const row = await this.prisma.client.findUnique({
            where: { id: existingId },
            select: { companyId: true },
          });
          if (!row || row.companyId !== receiverCompanyId) {
            throw new BadRequestException(
              "La entidad seleccionada no existe o no pertenece a su empresa.",
            );
          }
        } else if (et === "FV_STUDY") {
          const row = await this.prisma.fvStudy.findUnique({
            where: { id: existingId },
            select: { companyId: true },
          });
          if (!row || row.companyId !== receiverCompanyId) {
            throw new BadRequestException(
              "La entidad seleccionada no existe o no pertenece a su empresa.",
            );
          }
        } else if (et === "QUOTE") {
          const row = await this.prisma.quote.findUnique({
            where: { id: existingId },
            select: { companyId: true },
          });
          if (!row || row.companyId !== receiverCompanyId) {
            throw new BadRequestException(
              "La entidad seleccionada no existe o no pertenece a su empresa.",
            );
          }
        }
        targetEntityId = existingId;
      }

      await this.prisma.sharedEntityImportDecision.update({
        where: { id: decision.id },
        data: {
          status: "INTEGRATED",
          resolutionMode: mode,
          targetEntityId,
          errorMessage: null,
          resolvedAt: new Date(),
        },
      });
      return { ok: true, status: "INTEGRATED", targetEntityId };
    } catch (e) {
      await this.prisma.sharedEntityImportDecision.update({
        where: { id: decision.id },
        data: {
          status: "ERROR",
          errorMessage: e instanceof Error ? e.message : "Error de integración",
          resolvedAt: new Date(),
        },
      });
      throw e;
    }
  }

  async getSharedEntityResolutionContext(messageId: string, receiverUserId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { sharedEntity: true },
    });
    if (!msg || !msg.sharedEntity) {
      throw new NotFoundException("Mensaje compartido no encontrado.");
    }
    await this.assertMember(msg.conversationId, receiverUserId);
    const decision = await this.prisma.sharedEntityImportDecision.findUnique({
      where: { messageId_receiverUserId: { messageId, receiverUserId } },
    });
    if (!decision) {
      throw new ForbiddenException("Este mensaje no está disponible para su usuario.");
    }
    let snapshot: Record<string, unknown> = {};
    try {
      const s = JSON.parse(msg.sharedEntity.snapshotJson) as unknown;
      if (s && typeof s === "object") snapshot = s as Record<string, unknown>;
    } catch {
      snapshot = {};
    }
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverUserId },
      select: { companyId: true },
    });
    const receiverCompanyId = receiver?.companyId?.trim() || null;
    const entityTypeRequiresTenant =
      msg.sharedEntity.entityType === "CLIENT" ||
      msg.sharedEntity.entityType === "FV_STUDY" ||
      msg.sharedEntity.entityType === "QUOTE";
    if (entityTypeRequiresTenant && !receiverCompanyId) {
      throw new BadRequestException("Usuario sin empresa asignada.");
    }
    const candidates = await this.findDuplicateCandidates(
      msg.sharedEntity.entityType,
      snapshot,
      receiverCompanyId,
    );
    return {
      messageId,
      entityType: msg.sharedEntity.entityType,
      snapshot,
      myStatus: decision.status,
      options: ["ACCEPT_USE_EXISTING", "ACCEPT_LINK_EXISTING", "ACCEPT_CREATE_NEW", "REJECT"],
      candidates,
    };
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    });
    if (!message) {
      throw new NotFoundException("Mensaje no encontrado.");
    }
    await this.assertMember(message.conversationId, userId);
    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji },
      });
    }
    const fresh = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
    });
    const reactions = this.groupReactions(fresh, userId);
    await this.conversationsGateway.emitMessageReactionUpdated(
      message.conversationId,
      messageId,
      reactions,
    );
    return { ok: true, messageId, reactions };
  }

  async createFileMessage(
    conversationId: string,
    authorId: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      size?: number;
      originalname?: string;
    },
    dto: { body?: string; replyToMessageId?: string },
    authUser: AuthUserPayload,
  ) {
    await this.assertMember(conversationId, authorId);
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("Debe adjuntar un archivo.");
    }
    const fileSize = Number(file.size ?? file.buffer.length);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new BadRequestException("Archivo inválido.");
    }
    if (fileSize > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        `El archivo supera el límite de ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`,
      );
    }
    const caption = (dto.body ?? "").trim();
    if (caption.length > MAX_BODY) {
      throw new BadRequestException(
        `Mensaje demasiado largo (máx. ${MAX_BODY} caracteres)`,
      );
    }
    let replyTo: StoredMetadata["replyTo"] = null;
    if (dto.replyToMessageId?.trim()) {
      const replyMessage = await this.prisma.message.findUnique({
        where: { id: dto.replyToMessageId.trim() },
        include: {
          author: { select: { fullName: true, name: true, email: true } },
        },
      });
      if (!replyMessage || replyMessage.conversationId !== conversationId) {
        throw new BadRequestException("El mensaje al que responde no existe en esta conversación.");
      }
      const snippetRaw = replyMessage.body.trim();
      replyTo = {
        messageId: replyMessage.id,
        authorNameSnapshot:
          replyMessage.author.fullName ??
          replyMessage.author.name ??
          replyMessage.author.email,
        bodySnippet: snippetRaw.length > 140 ? `${snippetRaw.slice(0, 137)}...` : snippetRaw,
      };
    }
    const metadataJson = replyTo
      ? JSON.stringify({ mentions: [], quoteRefs: [], replyTo })
      : null;
    const safeOriginal = this.sanitizeFileName(file.originalname ?? "archivo");
    const storedFileName = `${randomUUID()}${this.extFromOriginal(safeOriginal)}`;
    const relativePath = `${ATTACHMENTS_SUBDIR}/${storedFileName}`;
    const storageKey = this.storageKeyForCompany(authUser.companyId, relativePath);
    const contentType = file.mimetype || "application/octet-stream";
    await this.objectStorage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType,
    });
    let msg;
    try {
      msg = await this.prisma.message.create({
        data: {
          conversationId,
          authorId,
          kind: "FILE",
          body: caption,
          metadataJson,
          attachments: {
            create: {
              originalFileName: safeOriginal,
              mimeType: contentType,
              sizeBytes: fileSize,
              storagePath: storageKey,
            },
          },
        },
      });
    } catch (e) {
      await this.objectStorage.removeObject(storageKey);
      throw e;
    }
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    const author = await this.prisma.user.findUniqueOrThrow({
      where: { id: authorId },
      select: { id: true, email: true, name: true, fullName: true },
    });
    const attachment = await this.prisma.messageAttachment.findFirstOrThrow({
      where: { messageId: msg.id },
      select: {
        id: true,
        originalFileName: true,
        mimeType: true,
        sizeBytes: true,
      },
    });
    const out = {
      id: msg.id,
      body: msg.body,
      kind: msg.kind as "FILE",
      createdAt: msg.createdAt.toISOString(),
      authorId: msg.authorId,
      authorName: author.fullName ?? author.name ?? author.email,
      metadata: replyTo
        ? {
            mentions: [],
            quoteRefs: [],
            replyTo,
          }
        : null,
      sharedEntity: null,
      reactions: [],
      attachments: [this.toAttachmentApi(msg.id, attachment)],
    };
    await this.conversationsGateway.emitMessageNew(conversationId, out);
    return out;
  }

  async getAttachmentForDownload(
    messageId: string,
    attachmentId: string,
    userId: string,
  ) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    });
    if (!msg) {
      throw new NotFoundException("Mensaje no encontrado.");
    }
    await this.assertMember(msg.conversationId, userId);
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        messageId: true,
        originalFileName: true,
        mimeType: true,
        sizeBytes: true,
        storagePath: true,
      },
    });
    if (!attachment || attachment.messageId !== messageId) {
      throw new NotFoundException("Adjunto no encontrado.");
    }
    let buffer: Buffer;
    try {
      buffer = await this.objectStorage.getBuffer(attachment.storagePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "NOT_FOUND") {
        throw new NotFoundException("Archivo adjunto no encontrado en almacenamiento.");
      }
      throw err;
    }
    return {
      buffer,
      fileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  async assertMember(conversationId: string, userId: string) {
    const m = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId, leftAt: null },
    });
    if (!m) {
      throw new ForbiddenException("No pertenece a esta conversación");
    }
  }

  // ——— P2P / libp2p bridge ———

  async registerUserP2pIdentity(opts: {
    userId: string;
    peerId: string;
    installationId: string;
    displayName?: string | null;
  }): Promise<void> {
    await this.prisma.userP2pIdentity.upsert({
      where: {
        userId_installationId: {
          userId: opts.userId,
          installationId: opts.installationId,
        },
      },
      create: {
        userId: opts.userId,
        installationId: opts.installationId,
        peerId: opts.peerId,
        displayName: opts.displayName ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        peerId: opts.peerId,
        displayName: opts.displayName ?? null,
        lastSeenAt: new Date(),
      },
    });
    await this.lanP2pBridge.setLocalIdentity(
      opts.userId,
      opts.installationId,
      opts.displayName ?? undefined,
    );
  }

  async ingestP2pPresence(raw: Record<string, unknown>) {
    const peerId = String(raw.peerId ?? "").trim();
    const installationId = String(raw.installationId ?? "").trim();
    const userId = String(raw.userId ?? "").trim();
    if (!peerId || !installationId || !userId) {
      throw new BadRequestException("presence inválida");
    }
    const displayName =
      typeof raw.displayName === "string" ? raw.displayName : null;
    await this.registerUserP2pIdentity({
      userId,
      peerId,
      installationId,
      displayName,
    });
    return { ok: true };
  }

  async ingestP2pChatMessage(raw: Record<string, unknown>) {
    const messageId = String(raw.messageId ?? "").trim();
    const conversationId = String(raw.conversationId ?? "").trim();
    const senderUserId = String(raw.senderUserId ?? "").trim();
    const body = String(raw.body ?? "").trim();
    if (!messageId || !conversationId || !senderUserId) {
      throw new BadRequestException("chat-message inválido");
    }
    if (!body) {
      throw new BadRequestException("cuerpo vacío");
    }
    const othersPre = await this.prisma.conversationMember.findMany({
      where: {
        conversationId,
        userId: { not: senderUserId },
        leftAt: null,
      },
      select: { userId: true },
      take: 4,
    });
    const receiverUserIdHint = othersPre[0]?.userId ?? "";

    const dup = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (dup) {
      return { ok: true, duplicate: true, receiverUserId: receiverUserIdHint };
    }
    await this.assertMember(conversationId, senderUserId);
    const msg = await this.prisma.message.create({
      data: {
        id: messageId,
        conversationId,
        authorId: senderUserId,
        body,
        kind: "TEXT",
        metadataJson: null,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    const author = await this.prisma.user.findUniqueOrThrow({
      where: { id: senderUserId },
      select: { id: true, email: true, name: true, fullName: true },
    });
    const out = {
      id: msg.id,
      body: msg.body,
      kind: msg.kind,
      createdAt: msg.createdAt.toISOString(),
      authorId: msg.authorId,
      authorName: author.fullName ?? author.name ?? author.email,
      metadata: null,
      sharedEntity: null,
      reactions: [],
      attachments: [],
    };
    await this.conversationsGateway.emitMessageNew(conversationId, out);
    const localReceiverUserId = receiverUserIdHint;
    await this.sendP2pStoredAckFromIngest({
      conversationId,
      messageId,
      senderUserId,
      senderInstallationId: String(raw.senderInstallationId ?? "").trim(),
      receiverUserId: localReceiverUserId,
    });
    return { ok: true, receiverUserId: localReceiverUserId };
  }

  private async sendP2pStoredAckFromIngest(opts: {
    conversationId: string;
    messageId: string;
    senderUserId: string;
    senderInstallationId: string;
    receiverUserId: string;
  }): Promise<void> {
    if (!this.lanP2pBridge.isEnabled()) return;
    const peer = await this.prisma.userP2pIdentity.findUnique({
      where: {
        userId_installationId: {
          userId: opts.senderUserId,
          installationId: opts.senderInstallationId,
        },
      },
    });
    if (!peer?.peerId) return;
    const env: DirectEnvelope = {
      op: "CHAT_STORED_ACK",
      message_id: opts.messageId,
      conversation_id: opts.conversationId,
      receiver_installation_id: this.getLocalPvqInstallationId(),
      receiver_user_id: opts.receiverUserId || undefined,
    };
    await this.lanP2pBridge.sendDirectMessage(peer.peerId, env);
  }

  async applyP2pOutboundAck(raw: Record<string, unknown>) {
    const kind = String(raw.kind ?? "").toUpperCase();
    const messageId = String(raw.messageId ?? "").trim();
    const targetUserId = String(raw.targetUserId ?? "").trim();
    if (!messageId) {
      throw new BadRequestException("ack inválido");
    }
    const state = kind === "DELIVERED" ? "DELIVERED" : kind === "STORED" ? "STORED" : null;
    if (!state) {
      throw new BadRequestException("kind inválido");
    }
    if (targetUserId) {
      await this.prisma.p2pMessageDelivery.updateMany({
        where: { messageId, targetUserId },
        data: { state, lastError: null },
      });
    } else {
      await this.prisma.p2pMessageDelivery.updateMany({
        where: { messageId, state: { in: ["SENT", "DELIVERED", "QUEUED"] } },
        data: { state, lastError: null },
      });
    }
    return { ok: true };
  }

  async p2pSyncGetMessagesSince(raw: Record<string, unknown>) {
    const conversationId = String(raw.conversationId ?? "").trim();
    const requesterUserId = String(raw.requesterUserId ?? "").trim();
    if (!conversationId || !requesterUserId) {
      throw new BadRequestException("sync inválido");
    }
    await this.assertMember(conversationId, requesterUserId);
    const lastMs = raw.lastCreatedAtUnixMs != null ? Number(raw.lastCreatedAtUnixMs) : NaN;
    const where: Prisma.MessageWhereInput = { conversationId };
    if (Number.isFinite(lastMs)) {
      where.createdAt = { gt: new Date(lastMs) };
    }
    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 80,
      select: {
        id: true,
        conversationId: true,
        authorId: true,
        body: true,
        createdAt: true,
        author: {
          select: {
            p2pIdentities: {
              orderBy: { lastSeenAt: "desc" },
              take: 1,
              select: { installationId: true },
            },
          },
        },
      },
    });
    return {
      ok: true,
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        authorId: m.authorId,
        body: m.body,
        created_at_unix_ms: m.createdAt.getTime(),
        sender_installation_id: m.author.p2pIdentities[0]?.installationId ?? "",
      })),
    };
  }

  async ingestP2pFileComplete(raw: Record<string, unknown>) {
    const transferId = String(raw.transferId ?? "").trim();
    const sha256Ok = raw.sha256Verified === true;
    const localPath = String(raw.localPath ?? "").trim();
    if (!transferId) {
      throw new BadRequestException("file-complete inválido");
    }
    await this.prisma.p2pFileTransfer.updateMany({
      where: { transferId },
      data: {
        state: sha256Ok ? "COMPLETE" : "FAILED",
        ...(localPath ? { localPath } : {}),
      },
    });
    return { ok: true };
  }

  async ingestP2pFileOffer(raw: Record<string, unknown>) {
    const transferId = String(raw.transferId ?? "").trim();
    const conversationId = String(raw.conversationId ?? "").trim();
    const peerId = String(raw.peerId ?? "").trim();
    const fileName = String(raw.fileName ?? "file").trim();
    const mimeType = String(raw.mimeType ?? "application/octet-stream");
    const sizeBytes = Math.max(0, parseInt(String(raw.sizeBytes ?? "0"), 10) || 0);
    const sha256Hex = String(raw.sha256Hex ?? "").trim();
    const chunkSize = Math.max(1, parseInt(String(raw.chunkSize ?? "0"), 10) || 65536);
    const totalChunks = Math.max(1, parseInt(String(raw.totalChunks ?? "1"), 10) || 1);
    const direction = String(raw.direction ?? "INBOUND").toUpperCase();
    if (!transferId || !conversationId || !peerId) {
      throw new BadRequestException("file-offer inválido");
    }
    const auto =
      (process.env.P2P_FILE_AUTO_ACCEPT ?? "").trim() === "1" ||
      (process.env.P2P_FILE_AUTO_ACCEPT ?? "").toLowerCase() === "true";
    await this.prisma.p2pFileTransfer.upsert({
      where: { transferId },
      create: {
        transferId,
        conversationId,
        direction,
        peerId,
        state: auto ? "ACCEPTED" : "OFFERED",
        fileName,
        mimeType,
        sizeBytes,
        sha256Hex: sha256Hex || "unknown",
        chunkSize,
        totalChunks,
      },
      update: {
        state: auto ? "ACCEPTED" : "OFFERED",
      },
    });
    return { ok: true, accept: auto, transferId };
  }

  async ingestP2pFileProgress(raw: Record<string, unknown>) {
    const transferId = String(raw.transferId ?? "").trim();
    const receivedBytes = Math.max(0, parseInt(String(raw.receivedBytes ?? "0"), 10) || 0);
    const state = String(raw.state ?? "TRANSFERRING");
    if (!transferId) throw new BadRequestException();
    await this.prisma.p2pFileTransfer.updateMany({
      where: { transferId },
      data: { receivedBytes, state },
    });
    return { ok: true };
  }

  private async forwardP2pAfterSave(opts: {
    conversationId: string;
    messageId: string;
    authorId: string;
    body: string;
    receiverUserIds: string[];
  }): Promise<void> {
    if (!this.lanP2pBridge.isEnabled()) return;
    const installId = this.getLocalPvqInstallationId();
    const envelope: DirectEnvelope = {
      op: "CHAT_MESSAGE",
      message_id: opts.messageId,
      conversation_id: opts.conversationId,
      sender_installation_id: installId,
      sender_user_id: opts.authorId,
      body: opts.body,
      created_at_unix_ms: Date.now(),
    };
    for (const uid of opts.receiverUserIds) {
      const peer = await this.resolveBestPeerIdentity(uid);
      const peerId = peer?.peerId ?? "";
      await this.prisma.p2pMessageDelivery.upsert({
        where: {
          messageId_targetUserId: { messageId: opts.messageId, targetUserId: uid },
        },
        create: {
          messageId: opts.messageId,
          targetUserId: uid,
          targetPeerId: peerId || "unknown",
          state: peerId ? "QUEUED" : "FAILED",
          lastError: peerId ? null : "no_peer",
        },
        update: {
          targetPeerId: peerId || "unknown",
        },
      });
      if (!peerId) continue;
      try {
        const r = await this.lanP2pBridge.sendDirectMessage(peerId, envelope);
        await this.prisma.p2pMessageDelivery.updateMany({
          where: { messageId: opts.messageId, targetUserId: uid },
          data: {
            // "ok" aquí solo confirma dispatch al daemon local; la entrega real se confirma con ACK.
            state: r.ok ? "SENT" : "QUEUED",
            lastError: r.ok ? null : (r.error ?? "send_failed"),
            attempts: { increment: 1 },
          },
        });
      } catch (e) {
        await this.prisma.p2pMessageDelivery.updateMany({
          where: { messageId: opts.messageId, targetUserId: uid },
          data: {
            state: "QUEUED",
            lastError: e instanceof Error ? e.message : String(e),
            attempts: { increment: 1 },
          },
        });
      }
    }
  }

  private async retryP2pQueuedDeliveries(): Promise<void> {
    if (!this.lanP2pBridge.isEnabled()) return;
    const sentRetryBefore = new Date(Date.now() - P2P_SENT_RETRY_AFTER_MS);
    const pending = await this.prisma.p2pMessageDelivery.findMany({
      where: {
        OR: [
          { state: { in: ["QUEUED", "FAILED"] } },
          { state: "SENT", updatedAt: { lt: sentRetryBefore } },
        ],
        attempts: { lt: 80 },
      },
      take: 30,
      orderBy: { updatedAt: "asc" },
    });
    for (const row of pending) {
      let targetPeerId = row.targetPeerId;
      const latestPeer = await this.resolveBestPeerIdentity(row.targetUserId);
      if (latestPeer?.peerId && latestPeer.peerId !== row.targetPeerId) {
        targetPeerId = latestPeer.peerId;
        await this.prisma.p2pMessageDelivery.update({
          where: { id: row.id },
          data: { targetPeerId: targetPeerId },
        });
      }
      if (targetPeerId === "unknown") continue;
      const msg = await this.prisma.message.findUnique({
        where: { id: row.messageId },
        include: { author: { select: { id: true, email: true } } },
      });
      if (!msg) continue;
      const envelope: DirectEnvelope = {
        op: "CHAT_MESSAGE",
        message_id: msg.id,
        conversation_id: msg.conversationId,
        sender_installation_id: this.getLocalPvqInstallationId(),
        sender_user_id: msg.authorId,
        body: msg.body,
        created_at_unix_ms: msg.createdAt.getTime(),
      };
      try {
        const r = await this.lanP2pBridge.sendDirectMessage(targetPeerId, envelope);
        await this.prisma.p2pMessageDelivery.update({
          where: { id: row.id },
          data: {
            state: r.ok ? "SENT" : "QUEUED",
            lastError: r.ok ? null : (r.error ?? "retry"),
            attempts: { increment: 1 },
          },
        });
      } catch (e) {
        await this.prisma.p2pMessageDelivery.update({
          where: { id: row.id },
          data: {
            attempts: { increment: 1 },
            lastError: e instanceof Error ? e.message : String(e),
          },
        });
      }
    }
  }
}
