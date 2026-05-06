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
var ConversationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const client_1 = require("@prisma/client");
const pdf_lib_1 = require("pdf-lib");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const quote_access_helper_1 = require("../quotes/quote-access.helper");
const lan_discovery_service_1 = require("../lan/lan-discovery.service");
const lan_p2p_bridge_service_1 = require("../lan-p2p-bridge/lan-p2p-bridge.service");
const conversation_presence_service_1 = require("./conversation-presence.service");
const conversations_gateway_1 = require("./conversations.gateway");
const MAX_BODY = 10000;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ATTACHMENTS_SUBDIR = "chat-attachments";
/** Tiempo por peer en fetch paralelo (mesh). */
const LAN_MESH_FETCH_MS = 8000;
const P2P_SENT_RETRY_AFTER_MS = 30_000;
/** Hash almacenado (bcrypt) o material mínimo para crear cuenta replicada desde un peer. */
function meshPasswordOkForCreate(p) {
    return typeof p === "string" && p.length >= 10;
}
/** Une filas del mismo email de varios peers: conserva hash si solo uno lo trae; prioriza nombre más completo. */
function mergeMeshUserRows(prev, raw, emailLower) {
    const next = { ...raw, email: emailLower };
    if (!prev)
        return next;
    const prevPwd = meshPasswordOkForCreate(prev.password);
    const nextPwd = meshPasswordOkForCreate(next.password);
    const prevLen = (prev.fullName ?? prev.name ?? "").length;
    const nextLen = (next.fullName ?? next.name ?? "").length;
    if (nextPwd && !prevPwd)
        return next;
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
function parseMetadataStored(raw) {
    if (raw == null || raw.trim() === "") {
        return null;
    }
    try {
        const o = JSON.parse(raw);
        if (!o || typeof o !== "object") {
            return null;
        }
        const obj = o;
        const mentions = Array.isArray(obj.mentions)
            ? obj.mentions.filter((x) => typeof x === "string")
            : [];
        const quoteRefsRaw = obj.quoteRefs;
        const quoteRefs = [];
        if (Array.isArray(quoteRefsRaw)) {
            for (const r of quoteRefsRaw) {
                if (!r || typeof r !== "object") {
                    continue;
                }
                const q = r;
                if (typeof q.quoteId === "string" &&
                    typeof q.titleSnapshot === "string") {
                    quoteRefs.push({
                        quoteId: q.quoteId,
                        titleSnapshot: q.titleSnapshot,
                        commercialNumberSnapshot: q.commercialNumberSnapshot === null ||
                            q.commercialNumberSnapshot === undefined
                            ? null
                            : String(q.commercialNumberSnapshot),
                    });
                }
            }
        }
        const replyToRaw = obj.replyTo;
        let replyTo = null;
        if (replyToRaw && typeof replyToRaw === "object") {
            const r = replyToRaw;
            if (typeof r.messageId === "string" &&
                typeof r.authorNameSnapshot === "string" &&
                typeof r.bodySnippet === "string") {
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
    }
    catch {
        return null;
    }
}
let ConversationsService = ConversationsService_1 = class ConversationsService {
    constructor(prisma, conversationsGateway, conversationPresence, lanDiscovery, lanP2pBridge) {
        this.prisma = prisma;
        this.conversationsGateway = conversationsGateway;
        this.conversationPresence = conversationPresence;
        this.lanDiscovery = lanDiscovery;
        this.lanP2pBridge = lanP2pBridge;
        this.log = new common_1.Logger(ConversationsService_1.name);
        /** Última traza de directorio (para GET directory-diagnostics y logs). */
        this.lastDirectoryTraceByUser = new Map();
        this.warnedMeshSecretMissing = false;
        this.p2pRetryTimer = null;
    }
    onModuleInit() {
        if (this.lanP2pBridge.isEnabled()) {
            this.p2pRetryTimer = setInterval(() => {
                void this.retryP2pQueuedDeliveries();
            }, 12_000);
        }
    }
    onModuleDestroy() {
        if (this.p2pRetryTimer) {
            clearInterval(this.p2pRetryTimer);
            this.p2pRetryTimer = null;
        }
    }
    getLocalPvqInstallationId() {
        const v = (process.env.PVQ_INSTALLATION_ID ?? "").trim();
        return v.length > 0 ? v : "nest-dev";
    }
    async resolveBestPeerIdentity(userId) {
        const peer = await this.prisma.userP2pIdentity.findFirst({
            where: { userId, peerId: { not: "" } },
            orderBy: { lastSeenAt: "desc" },
            select: { peerId: true, installationId: true, lastSeenAt: true },
        });
        if (!peer?.peerId)
            return null;
        return peer;
    }
    lanMeshSecret() {
        const s = (process.env.LAN_MESH_SECRET ?? "").trim();
        return s.length >= 8 ? s : null;
    }
    async generateEntityPdfBuffer(entityType, title, summary) {
        const pdf = await pdf_lib_1.PDFDocument.create();
        const page = pdf.addPage([595, 842]); // A4 portrait
        const regular = await pdf.embedFont(pdf_lib_1.StandardFonts.Helvetica);
        const bold = await pdf.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
        let y = 800;
        page.drawText("Entidad compartida", {
            x: 48,
            y,
            size: 10,
            font: regular,
            color: (0, pdf_lib_1.rgb)(0.35, 0.35, 0.35),
        });
        y -= 24;
        page.drawText(title.trim() || "Sin titulo", {
            x: 48,
            y,
            size: 18,
            font: bold,
            color: (0, pdf_lib_1.rgb)(0.08, 0.08, 0.08),
        });
        y -= 24;
        page.drawText(`Tipo: ${entityType}`, {
            x: 48,
            y,
            size: 11,
            font: regular,
            color: (0, pdf_lib_1.rgb)(0.2, 0.2, 0.2),
        });
        y -= 26;
        if (summary) {
            const rows = Object.entries(summary).slice(0, 24);
            for (const [k, v] of rows) {
                const line = `${k}: ${v == null ? "—" : String(v)}`;
                if (y < 58)
                    break;
                page.drawText(line.slice(0, 140), {
                    x: 48,
                    y,
                    size: 10,
                    font: regular,
                    color: (0, pdf_lib_1.rgb)(0.18, 0.18, 0.18),
                });
                y -= 16;
            }
        }
        page.drawText(`Generado: ${new Date().toLocaleString("es-ES")}`, {
            x: 48,
            y: 36,
            size: 9,
            font: regular,
            color: (0, pdf_lib_1.rgb)(0.45, 0.45, 0.45),
        });
        const bytes = await pdf.save();
        return Buffer.from(bytes);
    }
    meshPeerBaseUrl(address, apiPort) {
        const host = address.includes(":") && !/^\d{1,3}(\.\d{1,3}){3}$/.test(address)
            ? `[${address}]`
            : address;
        return `http://${host}:${apiPort}/api`;
    }
    /**
     * Descarga listas de usuarios de todos los peers en paralelo; aplica upserts en SQLite en serie
     * (evita "database locked" y lista incompleta por debounce omitido).
     */
    async syncLanMeshUsersFromPeers() {
        const meshUserPull = [];
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
            if (peersSnapshot.length > 0)
                break;
            // Salida 2: peerCount se estabilizó (dos lecturas consecutivas iguales) y ya no es 0.
            if (peerCountFinal === peerCountPrev && peerCountFinal > 0)
                break;
            if (Date.now() >= deadlineMs) {
                peerWaitTimedOut = true;
                break;
            }
            peerWaitIterations += 1;
            peerCountPrev = peerCountFinal;
            await new Promise((r) => setTimeout(r, sleepMs));
        }
        const peers = peersSnapshot.sort((a, b) => `${a.address}:${a.apiPort}`.localeCompare(`${b.address}:${b.apiPort}`, "en"));
        // Descates del merge mesh (limitado a N eventos para no inundar logs/trace).
        const maxRowDiscardEvents = 200;
        let meshDuplicateEmailCount = 0;
        const meshCreateWithoutPasswordEmailsSet = new Set();
        const meshUpsertErrorEmailsSet = new Set();
        const meshCreateWithoutPasswordEmails = [];
        const meshUpsertErrorEmails = [];
        const meshRowDiscardEvents = [];
        const pushDiscardEvent = (evt) => {
            if (meshRowDiscardEvents.length >= maxRowDiscardEvents)
                return;
            meshRowDiscardEvents.push(evt);
        };
        const fetchResults = await Promise.all(peers.map(async (p) => {
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
                        ok: false,
                        error: `HTTP ${res.status}`,
                        users: [],
                    };
                }
                const data = (await res.json());
                const users = data.users ?? [];
                return { peerKey, ok: true, users };
            }
            catch (e) {
                clearTimeout(to);
                return {
                    peerKey,
                    ok: false,
                    error: e instanceof Error ? e.message : String(e),
                    users: [],
                };
            }
        }));
        let meshRemoteUsersTotal = 0;
        let meshSkippedNoEmail = 0;
        const byEmail = new Map();
        const meshNoEmailByKindMap = new Map();
        const meshNoEmailSamples = [];
        const maxNoEmailSamples = 50;
        const bumpNoEmailKind = (kind) => {
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
                    const emailField = u.email;
                    let emailKind = "other";
                    let emailType = typeof emailField;
                    let emailValueSample = null;
                    if (emailField === null) {
                        emailKind = "null";
                        emailValueSample = null;
                    }
                    else if (emailField === undefined) {
                        emailKind = "undefined";
                        emailValueSample = null;
                    }
                    else if (typeof emailField !== "string") {
                        emailKind = "non_string";
                        emailValueSample = String(emailField);
                    }
                    else {
                        const trimmed = emailField.trim();
                        if (!trimmed) {
                            emailKind = "empty_string";
                            emailValueSample = "";
                        }
                        else {
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
            }
            else {
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
                let existingId = null;
                const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT id FROM "User" WHERE lower("email") = lower(${emailRaw}) LIMIT 1`);
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
                    },
                });
                mergedRows += 1;
            }
            catch (e) {
                if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
                    const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `SELECT id FROM "User" WHERE lower("email") = lower(${emailRaw}) LIMIT 1`);
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
                        }
                        catch (e2) {
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
                    }
                    else {
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
                }
                else {
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
    async collectLanOnlineEmails() {
        const online = new Set();
        const presencePull = [];
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
        const peers = [...this.lanDiscovery.getStatus().peers].sort((a, b) => `${a.address}:${a.apiPort}`.localeCompare(`${b.address}:${b.apiPort}`, "en"));
        const results = await Promise.all(peers.map(async (p) => {
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
                    return { peerKey, ok: false, error: `HTTP ${res.status}` };
                }
                const j = (await res.json());
                const list = (j.onlineEmails ?? []).filter((e) => typeof e === "string" && e.trim() !== "");
                return { peerKey, ok: true, list };
            }
            catch (e) {
                clearTimeout(to);
                return {
                    peerKey,
                    ok: false,
                    error: e instanceof Error ? e.message : String(e),
                };
            }
        }));
        for (const r of results) {
            if (r.ok && "list" in r) {
                for (const e of r.list) {
                    online.add(e.trim().toLowerCase());
                }
                presencePull.push({ peer: r.peerKey, ok: true, count: r.list.length });
            }
            else {
                presencePull.push({
                    peer: r.peerKey,
                    ok: false,
                    error: "error" in r ? r.error : undefined,
                });
            }
        }
        return { online, presencePull };
    }
    async listDirectoryUsers(currentUserId, opts) {
        const lanStatus = this.lanDiscovery.getStatus();
        if (!this.warnedMeshSecretMissing &&
            this.lanMeshSecret() == null &&
            lanStatus.peerCount > 0) {
            this.warnedMeshSecretMissing = true;
            this.log.warn("PV_CONV_MESH: hay otros nodos en LAN pero LAN_MESH_SECRET no está definido (≥8 caracteres). " +
                "Sin él el directorio solo muestra usuarios de esta base de datos.");
        }
        const activeOthersBeforeMeshSync = await this.prisma.user.count({
            where: { active: true, id: { not: currentUserId } },
        });
        const { meshUserPull, mergedRows, meshRemoteUsersTotal, meshInMapAfterDedupe, meshSkippedNoEmail, meshCreateSkippedNoPassword, meshUpsertErrors, peerCountInitial, peerCountFinal, peerWaitIterations, peerWaitTimedOut, meshDuplicateEmailCount, meshCreateWithoutPasswordEmails, meshUpsertErrorEmails, meshRowDiscardEvents, meshNoEmailByKind, meshNoEmailSamples, } = await this.syncLanMeshUsersFromPeers();
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
            present: this.conversationPresence.isUserPresent(u.id) ||
                onlineEmails.has(u.email.trim().toLowerCase()),
            presenceStatus: this.conversationPresence.isUserPresent(u.id) ||
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
        const trace = {
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
        this.log.log(JSON.stringify({
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
        }));
        return out;
    }
    /** Diagnóstico para soporte (misma auth que el resto de conversaciones). */
    getLastDirectoryTraceForUser(userId) {
        return this.lastDirectoryTraceByUser.get(userId) ?? null;
    }
    async findExistingDirectConversation(userIdA, userIdB) {
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
    async createConversation(dto, createdById) {
        const ids = [
            ...new Set(dto.memberUserIds.map((x) => x.trim()).filter(Boolean)),
        ];
        if (dto.type === "DIRECT") {
            if (ids.length !== 1) {
                throw new common_1.BadRequestException("Conversación directa: indique exactamente un otro usuario en memberUserIds");
            }
            if (ids[0] === createdById) {
                throw new common_1.BadRequestException("No puede conversar consigo mismo");
            }
            const existing = await this.findExistingDirectConversation(createdById, ids[0]);
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
        }
        else {
            if (!dto.title?.trim()) {
                throw new common_1.BadRequestException("El título del grupo es obligatorio");
            }
            if (ids.length < 1) {
                throw new common_1.BadRequestException("Grupo: indique al menos un miembro además de usted en memberUserIds");
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
                throw new common_1.BadRequestException(`Usuario no encontrado o inactivo: ${uid}`);
            }
        }
        const conv = await this.prisma.$transaction(async (tx) => {
            const c = await tx.conversation.create({
                data: {
                    type: dto.type,
                    title: dto.type === "GROUP" ? dto.title.trim() : null,
                    createdById,
                    members: {
                        create: allMemberIds.map((userId) => ({
                            userId,
                            lastReadAt: null,
                        })),
                    },
                },
            });
            return c;
        });
        return this.mapConversationDetail(conv.id, createdById);
    }
    async listForUser(userId, opts) {
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
        const out = [];
        for (const m of memberships) {
            const c = m.conversation;
            const unread = await this.unreadCount(c.id, userId, m.lastReadAt);
            const last = c.messages[0] ?? null;
            let directPeerUserId = null;
            let present = null;
            let presenceStatus = null;
            let lastSeenAt = null;
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
                        body: last.body.length > 120
                            ? `${last.body.slice(0, 117)}...`
                            : last.body,
                        createdAt: last.createdAt.toISOString(),
                        authorId: last.authorId,
                        authorName: last.author.fullName ??
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
                return (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            });
        }
        return { conversations: out };
    }
    displayTitle(c, currentUserId) {
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
    async unreadCount(conversationId, userId, lastReadAt) {
        return this.prisma.message.count({
            where: {
                conversationId,
                authorId: { not: userId },
                ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
            },
        });
    }
    async getOne(conversationId, userId) {
        await this.assertMember(conversationId, userId);
        return this.mapConversationDetail(conversationId, userId);
    }
    async mapConversationDetail(conversationId, currentUserId) {
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
            throw new common_1.NotFoundException("Conversación no encontrada");
        }
        const membership = c.members.find((m) => m.userId === currentUserId);
        if (!membership) {
            throw new common_1.ForbiddenException("No pertenece a esta conversación");
        }
        const unread = await this.unreadCount(c.id, currentUserId, membership.lastReadAt);
        return {
            id: c.id,
            type: c.type,
            title: this.displayTitle({
                type: c.type,
                title: c.title,
                members: c.members,
            }, currentUserId),
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
    async archiveForUser(conversationId, userId) {
        await this.assertMember(conversationId, userId);
        const at = new Date();
        await this.prisma.conversationMember.updateMany({
            where: { conversationId, userId, leftAt: null },
            data: { archivedAt: at },
        });
        return { ok: true, archivedAt: at.toISOString() };
    }
    async unarchiveForUser(conversationId, userId) {
        await this.assertMember(conversationId, userId);
        await this.prisma.conversationMember.updateMany({
            where: { conversationId, userId, leftAt: null },
            data: { archivedAt: null },
        });
        return { ok: true };
    }
    async getMessages(conversationId, userId, query) {
        await this.assertMember(conversationId, userId);
        const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
        const fetchRows = async (whereExtra, order) => {
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
        let rows;
        if (!query.before) {
            rows = await fetchRows({}, "recent");
            rows.reverse();
        }
        else {
            const cursor = await this.prisma.message.findFirst({
                where: { id: query.before, conversationId },
            });
            if (!cursor) {
                throw new common_1.BadRequestException("Mensaje cursor no encontrado en esta conversación");
            }
            rows = await fetchRows({
                OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    {
                        AND: [
                            { createdAt: cursor.createdAt },
                            { id: { lt: cursor.id } },
                        ],
                    },
                ],
            }, "older");
            rows.reverse();
        }
        return this.formatMessageList(rows, userId);
    }
    storedToApi(stored, displayNameByUserId) {
        if (!stored ||
            (stored.mentions.length === 0 &&
                stored.quoteRefs.length === 0 &&
                !stored.replyTo)) {
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
    currentNodeName() {
        const envName = (process.env.PV_NODE_NAME ?? process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "").trim();
        return envName || "Nodo local";
    }
    groupReactions(reactions, viewerUserId) {
        const grouped = new Map();
        for (const r of reactions) {
            const curr = grouped.get(r.emoji);
            if (!curr) {
                grouped.set(r.emoji, {
                    emoji: r.emoji,
                    count: 1,
                    reactedByMe: r.userId === viewerUserId,
                });
            }
            else {
                curr.count += 1;
                if (r.userId === viewerUserId)
                    curr.reactedByMe = true;
            }
        }
        return [...grouped.values()].sort((a, b) => a.emoji.localeCompare(b.emoji));
    }
    uploadsBaseDir() {
        return path.join(process.cwd(), "uploads");
    }
    attachmentsDir() {
        return path.join(this.uploadsBaseDir(), ATTACHMENTS_SUBDIR);
    }
    sanitizeFileName(name) {
        const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
        return base || "archivo";
    }
    extFromOriginal(name) {
        const ext = path.extname(name || "").toLowerCase();
        if (!ext || ext.length > 10)
            return "";
        return ext;
    }
    toAttachmentApi(messageId, a) {
        return {
            id: a.id,
            fileName: a.originalFileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            downloadUrl: `/api/conversations/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(a.id)}/download`,
        };
    }
    buildSharedEntityApi(shared, viewerUserId) {
        if (!shared)
            return null;
        let snapshot = {};
        try {
            const parsed = JSON.parse(shared.snapshotJson);
            if (parsed && typeof parsed === "object") {
                snapshot = parsed;
            }
        }
        catch {
            snapshot = {};
        }
        const myDecision = shared.message.importDecisions.find((d) => d.receiverUserId === viewerUserId) ?? null;
        return {
            entityType: shared.entityType,
            sourceUserId: shared.sourceUserId,
            sourceUserName: shared.sourceUserName,
            sourceNodeName: shared.sourceNodeName,
            sourceEntityId: shared.sourceEntityId ?? null,
            snapshot,
            myStatus: myDecision?.status ?? null,
            myResolutionMode: myDecision?.resolutionMode ?? null,
            myTargetEntityId: myDecision?.targetEntityId ?? null,
            myErrorMessage: myDecision?.errorMessage ?? null,
        };
    }
    async formatMessageList(messages, viewerUserId) {
        const allMentionIds = new Set();
        for (const m of messages) {
            const s = parseMetadataStored(m.metadataJson);
            s?.mentions.forEach((id) => allMentionIds.add(id));
        }
        const users = allMentionIds.size > 0
            ? await this.prisma.user.findMany({
                where: { id: { in: [...allMentionIds] } },
                select: { id: true, fullName: true, name: true, email: true },
            })
            : [];
        const displayMap = new Map(users.map((u) => [u.id, u.fullName ?? u.name ?? u.email]));
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
                    attachments: (m.attachments ?? []).map((a) => this.toAttachmentApi(m.id, a)),
                };
            }),
        };
    }
    async getMentionableMemberUserIds(conversationId) {
        const rows = await this.prisma.conversationMember.findMany({
            where: { conversationId, leftAt: null },
            include: {
                user: { select: { id: true, active: true } },
            },
        });
        const set = new Set();
        for (const r of rows) {
            if (r.user.active) {
                set.add(r.userId);
            }
        }
        return set;
    }
    async createMessage(conversationId, authorId, dto, authUser) {
        await this.assertMember(conversationId, authorId);
        const trimmed = (dto.body ?? "").trim();
        const hasSharedEntity = !!dto.sharedEntity;
        if (!trimmed && !hasSharedEntity) {
            throw new common_1.BadRequestException("El mensaje no puede estar vacío");
        }
        if (trimmed.length > MAX_BODY) {
            throw new common_1.BadRequestException(`Mensaje demasiado largo (máx. ${MAX_BODY} caracteres)`);
        }
        const mentionIds = [...new Set((dto.mentions ?? []).filter(Boolean))];
        const quoteIdList = [...new Set((dto.quoteIds ?? []).filter(Boolean))];
        let replyTo = null;
        if (dto.replyToMessageId?.trim()) {
            const replyMessage = await this.prisma.message.findUnique({
                where: { id: dto.replyToMessageId.trim() },
                include: {
                    author: { select: { fullName: true, name: true, email: true } },
                },
            });
            if (!replyMessage || replyMessage.conversationId !== conversationId) {
                throw new common_1.BadRequestException("El mensaje al que responde no existe en esta conversación.");
            }
            const snippetRaw = replyMessage.body.trim();
            replyTo = {
                messageId: replyMessage.id,
                authorNameSnapshot: replyMessage.author.fullName ??
                    replyMessage.author.name ??
                    replyMessage.author.email,
                bodySnippet: snippetRaw.length > 140 ? `${snippetRaw.slice(0, 137)}...` : snippetRaw,
            };
        }
        const memberIds = await this.getMentionableMemberUserIds(conversationId);
        for (const uid of mentionIds) {
            if (!memberIds.has(uid)) {
                throw new common_1.BadRequestException("Las menciones indicadas no son válidas para esta conversación.");
            }
        }
        const quoteRefs = [];
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
                },
            });
            if (!quote || !(0, quote_access_helper_1.canAccessQuote)(authUser, quote)) {
                throw new common_1.BadRequestException("No se pueden adjuntar una o más referencias solicitadas.");
            }
            quoteRefs.push({
                quoteId: quote.id,
                titleSnapshot: quote.title,
                commercialNumberSnapshot: quote.commercialNumber ?? null,
            });
        }
        let metadataJson = null;
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
        const msg = await this.prisma.$transaction(async (tx) => {
            const created = await tx.message.create({
                data: {
                    conversationId,
                    authorId,
                    body: trimmed,
                    kind: hasSharedEntity ? "SHARED_ENTITY" : "TEXT",
                    metadataJson,
                },
            });
            if (dto.sharedEntity) {
                await tx.messageSharedEntity.create({
                    data: {
                        messageId: created.id,
                        entityType: dto.sharedEntity.entityType,
                        snapshotJson: JSON.stringify(dto.sharedEntity.snapshot),
                        proposedImportJson: JSON.stringify(dto.sharedEntity.proposedImport),
                        sourceEntityId: dto.sharedEntity.sourceEntityId?.trim() || null,
                        sourceUserId: authorId,
                        sourceUserName: authUser.fullName ?? authUser.name ?? authUser.email,
                        sourceNodeName: this.currentNodeName(),
                    },
                });
                if (receiverIds.length > 0) {
                    await tx.sharedEntityImportDecision.createMany({
                        data: receiverIds.map((receiverUserId) => ({
                            messageId: created.id,
                            receiverUserId,
                            status: "PENDING",
                        })),
                    });
                }
            }
            return created;
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
        const mu = mentionIdsForEnrich.length > 0
            ? await this.prisma.user.findMany({
                where: { id: { in: mentionIdsForEnrich } },
                select: { id: true, fullName: true, name: true, email: true },
            })
            : [];
        const displayMap = new Map(mu.map((u) => [u.id, u.fullName ?? u.name ?? u.email]));
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
                    entityType: dto.sharedEntity.entityType,
                    sourceUserId: authorId,
                    sourceUserName: authUser.fullName ?? authUser.name ?? authUser.email,
                    sourceNodeName: this.currentNodeName(),
                    sourceEntityId: dto.sharedEntity.sourceEntityId?.trim() || null,
                    snapshot: dto.sharedEntity.snapshot,
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
        this.log.log(JSON.stringify({
            pvConvMessageSend: true,
            conversationId,
            messageId: out.id,
            authorId: out.authorId,
            authorEmail: author.email,
            saved: true,
            memberUserIds: membersForLog.map((m) => m.userId),
            memberEmails: membersForLog.map((m) => m.user.email.trim().toLowerCase()),
        }));
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
    async markRead(conversationId, userId) {
        const m = await this.prisma.conversationMember.findFirst({
            where: { conversationId, userId, leftAt: null },
        });
        if (!m) {
            throw new common_1.ForbiddenException("No pertenece a esta conversación");
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
    async findDuplicateCandidates(entityType, snapshot) {
        const safe = (v) => (typeof v === "string" ? v.trim() : "");
        if (entityType === "PRODUCT") {
            const q = safe(snapshot.name);
            if (!q)
                return [];
            const rows = await this.prisma.product.findMany({
                where: { name: { contains: q } },
                select: { id: true, name: true },
                take: 8,
            });
            return rows.map((r) => ({ id: r.id, label: r.name }));
        }
        if (entityType === "SUPPLIER") {
            const q = safe(snapshot.name);
            if (!q)
                return [];
            const rows = await this.prisma.supplier.findMany({
                where: { name: { contains: q } },
                select: { id: true, name: true },
                take: 8,
            });
            return rows.map((r) => ({ id: r.id, label: r.name }));
        }
        if (entityType === "CLIENT") {
            const q = safe(snapshot.name);
            if (!q)
                return [];
            const rows = await this.prisma.client.findMany({
                where: { name: { contains: q } },
                select: { id: true, name: true },
                take: 8,
            });
            return rows.map((r) => ({ id: r.id, label: r.name }));
        }
        if (entityType === "FV_STUDY") {
            const q = safe(snapshot.title);
            if (!q)
                return [];
            const rows = await this.prisma.fvStudy.findMany({
                where: { title: { contains: q } },
                select: { id: true, title: true },
                take: 8,
            });
            return rows.map((r) => ({ id: r.id, label: r.title }));
        }
        if (entityType === "QUOTE") {
            const q = safe(snapshot.title);
            if (!q)
                return [];
            const rows = await this.prisma.quote.findMany({
                where: { title: { contains: q } },
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
            if (!q)
                return [];
            const rows = await this.prisma.quoteTemplate.findMany({
                where: { name: { contains: q } },
                select: { id: true, name: true },
                take: 8,
            });
            return rows.map((r) => ({ id: r.id, label: r.name }));
        }
        return [];
    }
    async resolveSharedEntityMessage(messageId, receiverUserId, dto) {
        const msg = await this.prisma.message.findUnique({
            where: { id: messageId },
            include: {
                sharedEntity: true,
                conversation: { select: { id: true } },
            },
        });
        if (!msg || !msg.sharedEntity) {
            throw new common_1.NotFoundException("Mensaje compartido no encontrado.");
        }
        await this.assertMember(msg.conversationId, receiverUserId);
        const decision = await this.prisma.sharedEntityImportDecision.findUnique({
            where: { messageId_receiverUserId: { messageId, receiverUserId } },
        });
        if (!decision) {
            throw new common_1.ForbiddenException("Este mensaje no está pendiente para su usuario.");
        }
        let snapshot = {};
        let proposedImport = {};
        try {
            snapshot = JSON.parse(msg.sharedEntity.snapshotJson);
            proposedImport = JSON.parse(msg.sharedEntity.proposedImportJson);
        }
        catch {
            throw new common_1.BadRequestException("Payload compartido inválido.");
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
        if ((dto.decision === "ACCEPT_USE_EXISTING" || dto.decision === "ACCEPT_LINK_EXISTING") &&
            !dto.existingEntityId?.trim()) {
            const candidates = await this.findDuplicateCandidates(msg.sharedEntity.entityType, snapshot);
            throw new common_1.BadRequestException({
                message: "Debe seleccionar una entidad existente para esa opción.",
                mode: "MANUAL_RESOLUTION_REQUIRED",
                candidates,
                options: ["ACCEPT_USE_EXISTING", "ACCEPT_LINK_EXISTING", "ACCEPT_CREATE_NEW"],
            });
        }
        try {
            let targetEntityId = null;
            const mode = dto.decision === "ACCEPT_CREATE_NEW"
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
                            description: proposedImport.description != null ? String(proposedImport.description) : null,
                        },
                        select: { id: true },
                    });
                    targetEntityId = created.id;
                }
                else if (msg.sharedEntity.entityType === "SUPPLIER") {
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
                }
                else if (msg.sharedEntity.entityType === "CLIENT") {
                    const created = await this.prisma.client.create({
                        data: {
                            type: String(proposedImport.type ?? "EMPRESA"),
                            name: String(proposedImport.name ?? snapshot.name ?? "Cliente compartido"),
                            email: proposedImport.email != null ? String(proposedImport.email) : null,
                        },
                        select: { id: true },
                    });
                    targetEntityId = created.id;
                }
                else if (msg.sharedEntity.entityType === "FV_STUDY") {
                    throw new common_1.BadRequestException("En esta fase, estudios compartidos se aceptan por vinculación manual, no por creación directa.");
                }
                else if (msg.sharedEntity.entityType === "QUOTE" ||
                    msg.sharedEntity.entityType === "QUOTE_TEMPLATE") {
                    throw new common_1.BadRequestException("En esta fase, cotizaciones y plantillas compartidas se aceptan por vinculación manual, no por creación directa.");
                }
            }
            else {
                targetEntityId = dto.existingEntityId.trim();
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
        }
        catch (e) {
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
    async getSharedEntityResolutionContext(messageId, receiverUserId) {
        const msg = await this.prisma.message.findUnique({
            where: { id: messageId },
            include: { sharedEntity: true },
        });
        if (!msg || !msg.sharedEntity) {
            throw new common_1.NotFoundException("Mensaje compartido no encontrado.");
        }
        await this.assertMember(msg.conversationId, receiverUserId);
        const decision = await this.prisma.sharedEntityImportDecision.findUnique({
            where: { messageId_receiverUserId: { messageId, receiverUserId } },
        });
        if (!decision) {
            throw new common_1.ForbiddenException("Este mensaje no está disponible para su usuario.");
        }
        let snapshot = {};
        try {
            const s = JSON.parse(msg.sharedEntity.snapshotJson);
            if (s && typeof s === "object")
                snapshot = s;
        }
        catch {
            snapshot = {};
        }
        const candidates = await this.findDuplicateCandidates(msg.sharedEntity.entityType, snapshot);
        return {
            messageId,
            entityType: msg.sharedEntity.entityType,
            snapshot,
            myStatus: decision.status,
            options: ["ACCEPT_USE_EXISTING", "ACCEPT_LINK_EXISTING", "ACCEPT_CREATE_NEW", "REJECT"],
            candidates,
        };
    }
    async toggleReaction(messageId, userId, emoji) {
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
            select: { id: true, conversationId: true },
        });
        if (!message) {
            throw new common_1.NotFoundException("Mensaje no encontrado.");
        }
        await this.assertMember(message.conversationId, userId);
        const existing = await this.prisma.messageReaction.findUnique({
            where: { messageId_userId_emoji: { messageId, userId, emoji } },
            select: { id: true },
        });
        if (existing) {
            await this.prisma.messageReaction.delete({ where: { id: existing.id } });
        }
        else {
            await this.prisma.messageReaction.create({
                data: { messageId, userId, emoji },
            });
        }
        const fresh = await this.prisma.messageReaction.findMany({
            where: { messageId },
            select: { emoji: true, userId: true },
        });
        const reactions = this.groupReactions(fresh, userId);
        await this.conversationsGateway.emitMessageReactionUpdated(message.conversationId, messageId, reactions);
        return { ok: true, messageId, reactions };
    }
    async createFileMessage(conversationId, authorId, file, dto, authUser) {
        await this.assertMember(conversationId, authorId);
        if (!file?.buffer || file.buffer.length === 0) {
            throw new common_1.BadRequestException("Debe adjuntar un archivo.");
        }
        const fileSize = Number(file.size ?? file.buffer.length);
        if (!Number.isFinite(fileSize) || fileSize <= 0) {
            throw new common_1.BadRequestException("Archivo inválido.");
        }
        if (fileSize > MAX_ATTACHMENT_BYTES) {
            throw new common_1.BadRequestException(`El archivo supera el límite de ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`);
        }
        const caption = (dto.body ?? "").trim();
        if (caption.length > MAX_BODY) {
            throw new common_1.BadRequestException(`Mensaje demasiado largo (máx. ${MAX_BODY} caracteres)`);
        }
        let replyTo = null;
        if (dto.replyToMessageId?.trim()) {
            const replyMessage = await this.prisma.message.findUnique({
                where: { id: dto.replyToMessageId.trim() },
                include: {
                    author: { select: { fullName: true, name: true, email: true } },
                },
            });
            if (!replyMessage || replyMessage.conversationId !== conversationId) {
                throw new common_1.BadRequestException("El mensaje al que responde no existe en esta conversación.");
            }
            const snippetRaw = replyMessage.body.trim();
            replyTo = {
                messageId: replyMessage.id,
                authorNameSnapshot: replyMessage.author.fullName ??
                    replyMessage.author.name ??
                    replyMessage.author.email,
                bodySnippet: snippetRaw.length > 140 ? `${snippetRaw.slice(0, 137)}...` : snippetRaw,
            };
        }
        const metadataJson = replyTo
            ? JSON.stringify({ mentions: [], quoteRefs: [], replyTo })
            : null;
        await fs.mkdir(this.attachmentsDir(), { recursive: true });
        const safeOriginal = this.sanitizeFileName(file.originalname ?? "archivo");
        const storedFileName = `${(0, crypto_1.randomUUID)()}${this.extFromOriginal(safeOriginal)}`;
        const relativePath = `${ATTACHMENTS_SUBDIR}/${storedFileName}`;
        const absolutePath = path.join(this.uploadsBaseDir(), relativePath);
        const msg = await this.prisma.$transaction(async (tx) => {
            const created = await tx.message.create({
                data: {
                    conversationId,
                    authorId,
                    kind: "FILE",
                    body: caption,
                    metadataJson,
                },
            });
            await tx.messageAttachment.create({
                data: {
                    messageId: created.id,
                    originalFileName: safeOriginal,
                    mimeType: file.mimetype || "application/octet-stream",
                    sizeBytes: fileSize,
                    storagePath: relativePath,
                },
            });
            return created;
        });
        await fs.writeFile(absolutePath, file.buffer);
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
            kind: msg.kind,
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
    async getAttachmentForDownload(messageId, attachmentId, userId) {
        const msg = await this.prisma.message.findUnique({
            where: { id: messageId },
            select: { id: true, conversationId: true },
        });
        if (!msg) {
            throw new common_1.NotFoundException("Mensaje no encontrado.");
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
            throw new common_1.NotFoundException("Adjunto no encontrado.");
        }
        const abs = path.join(this.uploadsBaseDir(), attachment.storagePath);
        return {
            absolutePath: abs,
            fileName: attachment.originalFileName,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
        };
    }
    async assertMember(conversationId, userId) {
        const m = await this.prisma.conversationMember.findFirst({
            where: { conversationId, userId, leftAt: null },
        });
        if (!m) {
            throw new common_1.ForbiddenException("No pertenece a esta conversación");
        }
    }
    // ——— P2P / libp2p bridge ———
    async registerUserP2pIdentity(opts) {
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
        await this.lanP2pBridge.setLocalIdentity(opts.userId, opts.installationId, opts.displayName ?? undefined);
    }
    async ingestP2pPresence(raw) {
        const peerId = String(raw.peerId ?? "").trim();
        const installationId = String(raw.installationId ?? "").trim();
        const userId = String(raw.userId ?? "").trim();
        if (!peerId || !installationId || !userId) {
            throw new common_1.BadRequestException("presence inválida");
        }
        const displayName = typeof raw.displayName === "string" ? raw.displayName : null;
        await this.registerUserP2pIdentity({
            userId,
            peerId,
            installationId,
            displayName,
        });
        return { ok: true };
    }
    async ingestP2pChatMessage(raw) {
        const messageId = String(raw.messageId ?? "").trim();
        const conversationId = String(raw.conversationId ?? "").trim();
        const senderUserId = String(raw.senderUserId ?? "").trim();
        const body = String(raw.body ?? "").trim();
        if (!messageId || !conversationId || !senderUserId) {
            throw new common_1.BadRequestException("chat-message inválido");
        }
        if (!body) {
            throw new common_1.BadRequestException("cuerpo vacío");
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
    async sendP2pStoredAckFromIngest(opts) {
        if (!this.lanP2pBridge.isEnabled())
            return;
        const peer = await this.prisma.userP2pIdentity.findUnique({
            where: {
                userId_installationId: {
                    userId: opts.senderUserId,
                    installationId: opts.senderInstallationId,
                },
            },
        });
        if (!peer?.peerId)
            return;
        const env = {
            op: "CHAT_STORED_ACK",
            message_id: opts.messageId,
            conversation_id: opts.conversationId,
            receiver_installation_id: this.getLocalPvqInstallationId(),
            receiver_user_id: opts.receiverUserId || undefined,
        };
        await this.lanP2pBridge.sendDirectMessage(peer.peerId, env);
    }
    async applyP2pOutboundAck(raw) {
        const kind = String(raw.kind ?? "").toUpperCase();
        const messageId = String(raw.messageId ?? "").trim();
        const targetUserId = String(raw.targetUserId ?? "").trim();
        if (!messageId) {
            throw new common_1.BadRequestException("ack inválido");
        }
        const state = kind === "DELIVERED" ? "DELIVERED" : kind === "STORED" ? "STORED" : null;
        if (!state) {
            throw new common_1.BadRequestException("kind inválido");
        }
        if (targetUserId) {
            await this.prisma.p2pMessageDelivery.updateMany({
                where: { messageId, targetUserId },
                data: { state, lastError: null },
            });
        }
        else {
            await this.prisma.p2pMessageDelivery.updateMany({
                where: { messageId, state: { in: ["SENT", "DELIVERED", "QUEUED"] } },
                data: { state, lastError: null },
            });
        }
        return { ok: true };
    }
    async p2pSyncGetMessagesSince(raw) {
        const conversationId = String(raw.conversationId ?? "").trim();
        const requesterUserId = String(raw.requesterUserId ?? "").trim();
        if (!conversationId || !requesterUserId) {
            throw new common_1.BadRequestException("sync inválido");
        }
        await this.assertMember(conversationId, requesterUserId);
        const lastMs = raw.lastCreatedAtUnixMs != null ? Number(raw.lastCreatedAtUnixMs) : NaN;
        const where = { conversationId };
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
    async ingestP2pFileComplete(raw) {
        const transferId = String(raw.transferId ?? "").trim();
        const sha256Ok = raw.sha256Verified === true;
        const localPath = String(raw.localPath ?? "").trim();
        if (!transferId) {
            throw new common_1.BadRequestException("file-complete inválido");
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
    async ingestP2pFileOffer(raw) {
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
            throw new common_1.BadRequestException("file-offer inválido");
        }
        const auto = (process.env.P2P_FILE_AUTO_ACCEPT ?? "").trim() === "1" ||
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
    async ingestP2pFileProgress(raw) {
        const transferId = String(raw.transferId ?? "").trim();
        const receivedBytes = Math.max(0, parseInt(String(raw.receivedBytes ?? "0"), 10) || 0);
        const state = String(raw.state ?? "TRANSFERRING");
        if (!transferId)
            throw new common_1.BadRequestException();
        await this.prisma.p2pFileTransfer.updateMany({
            where: { transferId },
            data: { receivedBytes, state },
        });
        return { ok: true };
    }
    async forwardP2pAfterSave(opts) {
        if (!this.lanP2pBridge.isEnabled())
            return;
        const installId = this.getLocalPvqInstallationId();
        const envelope = {
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
            if (!peerId)
                continue;
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
            }
            catch (e) {
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
    async retryP2pQueuedDeliveries() {
        if (!this.lanP2pBridge.isEnabled())
            return;
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
            if (targetPeerId === "unknown")
                continue;
            const msg = await this.prisma.message.findUnique({
                where: { id: row.messageId },
                include: { author: { select: { id: true, email: true } } },
            });
            if (!msg)
                continue;
            const envelope = {
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
            }
            catch (e) {
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
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = ConversationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        conversations_gateway_1.ConversationsGateway,
        conversation_presence_service_1.ConversationPresenceService,
        lan_discovery_service_1.LanDiscoveryService,
        lan_p2p_bridge_service_1.LanP2pBridgeService])
], ConversationsService);
