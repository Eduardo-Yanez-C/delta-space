"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ConversationDetailDto,
  type ConversationListItemDto,
  type ConversationMessageDto,
  createConversationApi,
  fetchConversationDetail,
  fetchConversationMessages,
  fetchConversationsDirectoryUsers,
  fetchConversationsList,
  patchConversationArchiveForMe,
  postConversationFileMessage,
  postConversationMessage,
  postConversationRead,
  fetchConversationSharedEntityContext,
  getMe,
  resolveConversationSharedEntity,
  toggleConversationMessageReaction,
  downloadConversationMessageAttachment,
} from "../../lib/api";
import { MessageMetadataBlock } from "../../components/conversations/MessageMetadataBlock";
import { SuccessBanner } from "../../components/ui/SuccessBanner";
import { Modal } from "../../components/ui/Modal";
import { useCan } from "../../lib/useCan";
import { conversationsRealtime } from "../../lib/conversations-realtime";
import { AutocorrectTextarea } from "../../components/input/AutocorrectTextarea";
import { HighlightedText } from "../../components/conversations/HighlightedText";

const POLL_LIST_MS = 25_000;
const POLL_MESSAGES_MS = 12_000;
const PAGE_SIZE = 50;
const DIRECTORY_POLL_MS = 8000;
const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const COMPOSER_EMOJIS = [
  "😀", "😁", "😂", "😊", "😉", "😍", "😎", "🤝", "👏", "🙏",
  "👍", "👎", "🎉", "🔥", "💡", "✅", "⚡", "📌", "📎", "📅",
  "💬", "📈", "🛠️", "🚀",
] as const;

function userFriendlyChatError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("límite") || m.includes("mb")) {
    return "El archivo supera el tamaño permitido. Pruebe con uno más pequeño.";
  }
  if (m.includes("descargar")) return "No se pudo descargar el archivo. Intente nuevamente.";
  if (m.includes("integr")) return "No se pudo integrar la entidad compartida. Revise la opción elegida.";
  if (m.includes("reaccion")) return "No se pudo aplicar la reacción. Vuelva a intentarlo.";
  if (m.includes("enviar")) return "No se pudo enviar. Revise su conexión e intente otra vez.";
  return raw;
}

/**
 * El socket broadcast usa el mismo payload para todos; en createMessage el emisor lleva
 * myStatus null aunque los receptores tengan fila PENDING. Sin esto, la UI no muestra acciones hasta recargar.
 */
function enrichRealtimeSharedEntityForViewer(
  message: ConversationMessageDto,
  viewerUserId: string | null | undefined,
): ConversationMessageDto {
  if (!viewerUserId || message.kind !== "SHARED_ENTITY" || !message.sharedEntity) return message;
  if (message.authorId === viewerUserId) return message;
  const se = message.sharedEntity;
  if (se.myStatus != null) return message;
  return {
    ...message,
    sharedEntity: {
      ...se,
      myStatus: "PENDING",
      myResolutionMode: null,
      myTargetEntityId: null,
      myErrorMessage: null,
    },
  };
}

function conversationMatchesListFilter(
  c: ConversationListItemDto,
  q: string,
  directoryById: Map<string, { name: string; email: string }>,
): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const chunks: string[] = [c.title, c.rawTitle ?? ""];
  if (c.lastMessage) {
    chunks.push(c.lastMessage.body, c.lastMessage.authorName);
  }
  if (c.type === "DIRECT" && c.directPeerUserId) {
    const u = directoryById.get(c.directPeerUserId);
    if (u) {
      chunks.push(u.name, u.email);
    }
  }
  return chunks.some((s) => s.toLowerCase().includes(n));
}

function messageMatchesThreadSearch(m: ConversationMessageDto, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return false;
  if (m.body.toLowerCase().includes(n)) return true;
  if (m.authorName.toLowerCase().includes(n)) return true;
  for (const a of m.attachments ?? []) {
    if (a.fileName.toLowerCase().includes(n)) return true;
  }
  if (m.sharedEntity?.snapshot) {
    try {
      if (JSON.stringify(m.sharedEntity.snapshot).toLowerCase().includes(n)) return true;
    } catch {
      /* no-op */
    }
  }
  return false;
}

function DirectoryModalEmptyBlock({
  directoryError,
  showCompanionHint,
  canAccessUsers,
  onRetry,
}: {
  directoryError: string | null;
  showCompanionHint: boolean;
  canAccessUsers: boolean;
  onRetry: () => void;
}) {
  if (directoryError) {
    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="leading-relaxed">{directoryError}</p>
        <button
          type="button"
          className="mt-3 rounded-lg bg-amber-200/90 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200 dark:bg-amber-800 dark:text-amber-50 dark:hover:bg-amber-700"
          onClick={() => onRetry()}
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (showCompanionHint) {
    return (
      <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-relaxed text-sky-950 dark:border-sky-800/50 dark:bg-sky-950/25 dark:text-sky-100">
        <p className="font-medium text-sky-900 dark:text-sky-50">Aún no hay compañeros para elegir</p>
        <p className="mt-2 text-sky-900/90 dark:text-sky-100/90">
          Cuando otras personas inicien sesión con su usuario, aparecerán aquí (las que ya están conectadas salen
          primero). Si acaba de entrar al sistema, espere unos segundos y pulse reintentar.
        </p>
        {canAccessUsers ? (
          <p className="mt-3">
            <Link
              href="/usuarios"
              className="font-medium text-primary-600 underline hover:no-underline dark:text-primary-400"
            >
              Crear o revisar usuarios
            </Link>
          </p>
        ) : (
          <p className="mt-3 text-sky-900/85 dark:text-sky-200/85">
            Si faltan compañeros, quien administre la aplicación puede darlos de alta en Usuarios.
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-lg bg-slate-50 px-4 py-4 text-center text-sm leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
      <p>No hay más personas registradas para conversar en esta conexión.</p>
      {canAccessUsers ? (
        <p className="mt-3">
          <Link
            href="/usuarios"
            className="font-medium text-primary-600 underline hover:no-underline dark:text-primary-400"
          >
            Ir a Usuarios
          </Link>
        </p>
      ) : (
        <p className="mt-3">Pide a quien administre el sistema que cree cuentas para tu equipo.</p>
      )}
    </div>
  );
}

export default function ConversacionesPage() {
  const [list, setList] = useState<ConversationListItemDto[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [includeArchivedInList, setIncludeArchivedInList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessageDto[]>([]);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Si > 0, el usuario cargó mensajes anteriores; el poll no reemplaza todo el hilo. */
  const [olderLoadedCount, setOlderLoadedCount] = useState(0);
  const olderLoadedCountRef = useRef(0);
  olderLoadedCountRef.current = olderLoadedCount;
  const [threadDetail, setThreadDetail] = useState<ConversationDetailDto | null>(null);
  const [mentionUserIds, setMentionUserIds] = useState<Set<string>>(() => new Set());
  const [quoteIdsAttached, setQuoteIdsAttached] = useState<string[]>([]);
  const [quoteIdDraft, setQuoteIdDraft] = useState("");
  const [reactionPickerForMessageId, setReactionPickerForMessageId] = useState<string | null>(null);
  const [actionMenuForMessageId, setActionMenuForMessageId] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<{
    id: string;
    authorName: string;
    bodySnippet: string;
  } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState<"DIRECT" | "GROUP">("DIRECT");
  const [newTitle, setNewTitle] = useState("");
  const [newOtherUserId, setNewOtherUserId] = useState("");
  const [newGroupIds, setNewGroupIds] = useState<Set<string>>(new Set());
  const [directory, setDirectory] = useState<
    {
      id: string;
      email: string;
      name: string;
      present: boolean;
      presenceStatus?: "online" | "offline";
      lastSeenAt?: string | null;
    }[]
  >([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const canAccessUsers = useCan("access", "users");
  const showCompanionHint = directoryError == null && !directoryLoading && directory.length === 0;
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [threadFeedbackOk, setThreadFeedbackOk] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<{
    open: boolean;
    messageId: string | null;
    decision: "ACCEPT_USE_EXISTING" | "ACCEPT_LINK_EXISTING" | null;
    candidates: Array<{ id: string; label: string }>;
    selectedExistingId: string;
  }>({
    open: false,
    messageId: null,
    decision: null,
    candidates: [],
    selectedExistingId: "",
  });
  const [forwardModal, setForwardModal] = useState<{
    open: boolean;
    sourceMessage: ConversationMessageDto | null;
    destinationMode: "CONVERSATION" | "USER";
    selectedConversationId: string;
    selectedUserId: string;
    note: string;
    loading: boolean;
  }>({
    open: false,
    sourceMessage: null,
    destinationMode: "CONVERSATION",
    selectedConversationId: "",
    selectedUserId: "",
    note: "",
    loading: false,
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const listPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const highlightTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerFileInputRef = useRef<HTMLInputElement | null>(null);
  const viewerUserIdRef = useRef<string | null>(null);
  const messageElsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [threadMatchIndex, setThreadMatchIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getMe()
      .then((u) => {
        if (cancelled) return;
        viewerUserIdRef.current = u.id;
        setMessages((prev) => prev.map((m) => enrichRealtimeSharedEntityForViewer(m, u.id)));
      })
      .catch(() => {
        if (!cancelled) viewerUserIdRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    isNearBottomRef.current = isNearBottom;
  }, [isNearBottom]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-message-actions-root='true']")) {
        setActionMenuForMessageId(null);
        setActionMenuPosition(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!actionMenuForMessageId) return;
    const closeMenu = () => {
      setActionMenuForMessageId(null);
      setActionMenuPosition(null);
    };
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [actionMenuForMessageId]);

  const loadList = useCallback(async () => {
    try {
      setListError(null);
      const r = await fetchConversationsList({
        includeArchived: includeArchivedInList,
      });
      setList(
        r.conversations.map((c) => ({
          ...c,
          archivedAtForMe: c.archivedAtForMe ?? null,
          directPeerUserId: c.directPeerUserId ?? null,
          present: c.present ?? null,
          presenceStatus: c.presenceStatus ?? null,
          lastSeenAt: c.lastSeenAt ?? null,
        })),
      );
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Error al cargar conversaciones");
    }
  }, [includeArchivedInList]);

  useEffect(() => {
    void loadList();
    listPollRef.current = setInterval(() => void loadList(), POLL_LIST_MS);
    return () => {
      if (listPollRef.current) clearInterval(listPollRef.current);
    };
  }, [loadList]);

  useEffect(() => {
    const unsub = conversationsRealtime.onMessageNew((event) => {
      // REST sigue siendo la verdad para badges/unread/listado.
      void loadList();
      if (!selectedIdRef.current || event.conversationId !== selectedIdRef.current) {
        const convId = event.conversationId;
        const prevTimeout = highlightTimeoutsRef.current.get(convId);
        if (prevTimeout) {
          clearTimeout(prevTimeout);
        }
        setRecentlyUpdatedIds((prev) => {
          const next = new Set(prev);
          next.add(convId);
          return next;
        });
        const timeoutId = setTimeout(() => {
          setRecentlyUpdatedIds((prev) => {
            if (!prev.has(convId)) return prev;
            const next = new Set(prev);
            next.delete(convId);
            return next;
          });
          highlightTimeoutsRef.current.delete(convId);
        }, 1800);
        highlightTimeoutsRef.current.set(convId, timeoutId);
        return;
      }
      const shouldAutoScroll = isNearBottomRef.current;
      const incoming = enrichRealtimeSharedEntityForViewer(event.message, viewerUserIdRef.current);
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) {
          return prev;
        }
        return [...prev, incoming];
      });
      void postConversationRead(event.conversationId).catch(() => undefined);
      if (shouldAutoScroll) {
        scrollToBottom("smooth", true);
      }
    });
    const unsubReaction = conversationsRealtime.onReaction((event) => {
      if (!selectedIdRef.current || event.conversationId !== selectedIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === event.messageId ? { ...m, reactions: event.reactions } : m,
        ),
      );
    });
    return () => {
      unsub();
      unsubReaction();
      for (const t of highlightTimeoutsRef.current.values()) {
        clearTimeout(t);
      }
      highlightTimeoutsRef.current.clear();
    };
  }, [loadList]);

  /** Si deja de mostrar archivadas y el hilo abierto ya no está en el listado, cerrar selección. */
  useEffect(() => {
    if (includeArchivedInList || !selectedId) return;
    if (!list.some((c) => c.id === selectedId)) {
      setSelectedId(null);
    }
  }, [includeArchivedInList, list, selectedId]);

  const computeNearBottom = useCallback((el: HTMLDivElement | null): boolean => {
    if (!el) return true;
    const thresholdPx = 120;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= thresholdPx;
  }, []);

  const refreshNearBottom = useCallback(() => {
    const near = computeNearBottom(messagesScrollRef.current);
    setIsNearBottom(near);
  }, [computeNearBottom]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth", force = false) => {
      if (!force && !isNearBottomRef.current) return;
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior }));
    },
    [],
  );

  const loadThread = useCallback(
    async (conversationId: string, opts?: { mergeOlder?: boolean; before?: string }) => {
      setLoadingThread(!opts?.mergeOlder);
      setMsgError(null);
      try {
        if (opts?.mergeOlder && opts.before) {
          setLoadingMore(true);
          const r = await fetchConversationMessages(conversationId, {
            limit: PAGE_SIZE,
            before: opts.before,
          });
          setOlderLoadedCount((c) => c + r.messages.length);
          setMessages((prev) => [...r.messages, ...prev]);
          setHasMoreOlder(r.messages.length === PAGE_SIZE);
        } else {
          const r = await fetchConversationMessages(conversationId, { limit: PAGE_SIZE });
          setOlderLoadedCount(0);
          setMessages(r.messages);
          setHasMoreOlder(r.messages.length === PAGE_SIZE);
          await postConversationRead(conversationId);
          void loadList();
          scrollToBottom("auto", true);
        }
      } catch (e) {
        setMsgError(
          userFriendlyChatError(
            e instanceof Error ? e.message : "Error al cargar mensajes",
          ),
        );
      } finally {
        setLoadingThread(false);
        setLoadingMore(false);
      }
    },
    [loadList],
  );

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setThreadDetail(null);
      setMentionUserIds(new Set());
      setQuoteIdsAttached([]);
      setQuoteIdDraft("");
      setReactionPickerForMessageId(null);
      setActionMenuForMessageId(null);
      setActionMenuPosition(null);
      setEmojiPickerOpen(false);
      setPendingAttachment(null);
      setReplyToMessage(null);
      setThreadFeedbackOk(null);
      return;
    }
    setThreadFeedbackOk(null);
    setMentionUserIds(new Set());
    setQuoteIdsAttached([]);
    setQuoteIdDraft("");
    setReactionPickerForMessageId(null);
    setActionMenuForMessageId(null);
    setActionMenuPosition(null);
    setEmojiPickerOpen(false);
    setPendingAttachment(null);
    setReplyToMessage(null);
    void loadThread(selectedId);
    void (async () => {
      try {
        const d = await fetchConversationDetail(selectedId);
        setThreadDetail(d);
      } catch {
        setThreadDetail(null);
      }
    })();
  }, [selectedId, loadThread]);

  useEffect(() => {
    if (!selectedId) return;
    conversationsRealtime.joinConversation(selectedId);
    return () => {
      conversationsRealtime.leaveConversation(selectedId);
    };
  }, [selectedId]);

  useEffect(() => {
    if (msgPollRef.current) {
      clearInterval(msgPollRef.current);
      msgPollRef.current = null;
    }
    if (!selectedId) return;
    msgPollRef.current = setInterval(async () => {
      try {
        const r = await fetchConversationMessages(selectedId, { limit: PAGE_SIZE });
        setMessages((prev) => {
          if (olderLoadedCountRef.current > 0 && prev.length > 0) {
            const lastRemote = r.messages[r.messages.length - 1];
            const lastLocal = prev[prev.length - 1];
            if (!lastRemote || lastLocal?.id === lastRemote.id) return prev;
            return [...prev, ...r.messages.filter((m) => !prev.some((p) => p.id === m.id))];
          }
          if (prev.length === 0) return r.messages;
          const lastLocal = prev[prev.length - 1]?.id;
          const lastRemote = r.messages[r.messages.length - 1]?.id;
          if (lastLocal === lastRemote && prev.length > 0 && r.messages.length > 0) {
            const remoteLast = r.messages[r.messages.length - 1]!;
            return prev.map((m, i) => (i === prev.length - 1 ? remoteLast : m));
          }
          return r.messages;
        });
        await postConversationRead(selectedId);
        void loadList();
      } catch {
        /* ignore poll errors */
      }
    }, POLL_MESSAGES_MS);
    return () => {
      if (msgPollRef.current) clearInterval(msgPollRef.current);
    };
  }, [selectedId, loadList]);

  const loadDirectoryForModal = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;
    if (!background) {
      setDirectoryLoading(true);
      setDirectoryError(null);
    }
    try {
      // Fase 1 Xfire: la lista de contactos debe ser estable (no depende de presencia en el instante).
      // Presencia solo afecta el estado visual (ONLINE/OFFLINE).
      const r = await fetchConversationsDirectoryUsers();
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("[PV_CONV_MODAL_DIRECTORY]", {
          source: "fetchConversationsDirectoryUsers→setDirectory",
          count: r.users.length,
          emails: r.users.map((u) => u.email),
        });
      }
      setDirectory(r.users);
      if (!background) setDirectoryError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cargar la lista de contactos.";
      if (!background) {
        setDirectory([]);
        setDirectoryError(msg);
      }
    } finally {
      if (!background) setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectoryForModal({ background: true });
    const id = window.setInterval(
      () => void loadDirectoryForModal({ background: true }),
      DIRECTORY_POLL_MS,
    );
    return () => window.clearInterval(id);
  }, [loadDirectoryForModal]);

  useEffect(() => {
    if (!showNew) return;
    setDirectoryError(null);
    setDirectoryLoading(true);
    void loadDirectoryForModal();
  }, [showNew, loadDirectoryForModal]);

  useEffect(() => {
    const off = conversationsRealtime.onPresenceDelta(() => {
      void loadDirectoryForModal({ background: true });
    });
    return off;
  }, [loadDirectoryForModal]);

  const toggleMention = (userId: string) => {
    setMentionUserIds((prev) => {
      const n = new Set(prev);
      if (n.has(userId)) n.delete(userId);
      else n.add(userId);
      return n;
    });
  };

  const addQuoteId = () => {
    const id = quoteIdDraft.trim();
    if (!id) return;
    if (quoteIdsAttached.includes(id)) return;
    if (quoteIdsAttached.length >= 10) return;
    setQuoteIdsAttached((q) => [...q, id]);
    setQuoteIdDraft("");
  };

  const removeQuoteId = (id: string) => {
    setQuoteIdsAttached((q) => q.filter((x) => x !== id));
  };

  const send = async () => {
    if (!selectedId || sending || (!input.trim() && !pendingAttachment)) return;
    setSending(true);
    setMsgError(null);
    try {
      const mentions = mentionUserIds.size > 0 ? [...mentionUserIds] : undefined;
      const quoteIds = quoteIdsAttached.length > 0 ? quoteIdsAttached : undefined;
      if (pendingAttachment) {
        await postConversationFileMessage(selectedId, {
          file: pendingAttachment,
          body: input.trim() || undefined,
          ...(replyToMessage ? { replyToMessageId: replyToMessage.id } : {}),
        });
      } else {
        await postConversationMessage(selectedId, {
          body: input.trim(),
          ...(mentions ? { mentions } : {}),
          ...(quoteIds ? { quoteIds } : {}),
          ...(replyToMessage ? { replyToMessageId: replyToMessage.id } : {}),
        });
      }
      setInput("");
      setMentionUserIds(new Set());
      setQuoteIdsAttached([]);
      setQuoteIdDraft("");
      setReactionPickerForMessageId(null);
      setEmojiPickerOpen(false);
      setPendingAttachment(null);
      setReplyToMessage(null);
      const r = await fetchConversationMessages(selectedId, { limit: PAGE_SIZE });
      setMessages((prev) => {
        if (olderLoadedCountRef.current > 0) {
          const newOnes = r.messages.filter((nm) => !prev.some((p) => p.id === nm.id));
          return newOnes.length ? [...prev, ...newOnes] : prev;
        }
        return r.messages;
      });
      setHasMoreOlder(r.messages.length === PAGE_SIZE);
      await postConversationRead(selectedId);
      void loadList();
      scrollToBottom("smooth", true);
    } catch (e) {
      setMsgError(
        userFriendlyChatError(
          e instanceof Error ? e.message : "Error al enviar",
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const statusLabel = (status: "PENDING" | "INTEGRATED" | "REJECTED" | "ERROR" | null) => {
    if (status === "INTEGRATED") return "Integrado";
    if (status === "REJECTED") return "Rechazado";
    if (status === "ERROR") return "Error";
    return "Pendiente";
  };

  const statusClasses = (status: "PENDING" | "INTEGRATED" | "REJECTED" | "ERROR" | null) => {
    if (status === "INTEGRATED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    if (status === "REJECTED") return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
    if (status === "ERROR") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  };

  const handleResolveSharedEntity = async (
    messageId: string,
    decision: "REJECT" | "ACCEPT_CREATE_NEW" | "ACCEPT_USE_EXISTING" | "ACCEPT_LINK_EXISTING",
  ) => {
    if (decision === "ACCEPT_USE_EXISTING" || decision === "ACCEPT_LINK_EXISTING") {
      try {
        const ctx = await fetchConversationSharedEntityContext(messageId);
        setResolveModal({
          open: true,
          messageId,
          decision,
          candidates: ctx.candidates ?? [],
          selectedExistingId: ctx.candidates?.[0]?.id ?? "",
        });
      } catch (e) {
        setMsgError(
          userFriendlyChatError(
            e instanceof Error ? e.message : "No se pudo cargar coincidencias.",
          ),
        );
      }
      return;
    }
    setMsgError(null);
    try {
      await resolveConversationSharedEntity(messageId, { decision });
      if (selectedId) {
        const r = await fetchConversationMessages(selectedId, { limit: PAGE_SIZE });
        setMessages(r.messages);
      }
    } catch (e) {
      setMsgError(
        userFriendlyChatError(
          e instanceof Error ? e.message : "No se pudo resolver la entidad compartida.",
        ),
      );
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setMsgError(null);
    try {
      const out = await toggleConversationMessageReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === out.messageId ? { ...m, reactions: out.reactions } : m,
        ),
      );
      setReactionPickerForMessageId(null);
    } catch (e) {
      setMsgError(
        userFriendlyChatError(
          e instanceof Error ? e.message : "No se pudo reaccionar.",
        ),
      );
    }
  };

  const handleCopyMessage = async (m: ConversationMessageDto) => {
    try {
      await navigator.clipboard.writeText(m.body ?? "");
      setThreadFeedbackOk("Mensaje copiado al portapapeles.");
    } catch {
      setMsgError("No se pudo copiar el mensaje.");
    }
  };

  const handleShareMessage = async (m: ConversationMessageDto) => {
    setForwardModal({
      open: true,
      sourceMessage: m,
      destinationMode: "CONVERSATION",
      selectedConversationId: "",
      selectedUserId: "",
      note: "",
      loading: true,
    });
    try {
      const [conv, users] = await Promise.all([
        fetchConversationsList(),
        fetchConversationsDirectoryUsers(),
      ]);
      setForwardModal((prev) => ({
        ...prev,
        loading: false,
        selectedConversationId: conv.conversations[0]?.id ?? "",
        selectedUserId: users.users[0]?.id ?? "",
      }));
    } catch {
      setForwardModal((prev) => ({ ...prev, loading: false }));
      setMsgError("No se pudo cargar destinos para compartir.");
    }
  };

  const confirmForwardMessage = async () => {
    if (!forwardModal.sourceMessage) return;
    const source = forwardModal.sourceMessage;
    let conversationId = "";
    try {
      if (forwardModal.destinationMode === "CONVERSATION") {
        conversationId = forwardModal.selectedConversationId;
      } else {
        if (!forwardModal.selectedUserId) return;
        const created = await createConversationApi({
          type: "DIRECT",
          memberUserIds: [forwardModal.selectedUserId],
        });
        conversationId = created.id;
      }
      if (!conversationId) return;
      const prefix = `Reenviado de ${source.authorName}`;
      const forwardedBody = source.body?.trim() || "(sin texto)";
      await postConversationMessage(conversationId, {
        body: `${prefix}:\n${forwardedBody}`,
      });
      setForwardModal({
        open: false,
        sourceMessage: null,
        destinationMode: "CONVERSATION",
        selectedConversationId: "",
        selectedUserId: "",
        note: "",
        loading: false,
      });
      setThreadFeedbackOk("Mensaje reenviado dentro del sistema.");
    } catch {
      setMsgError("No se pudo reenviar el mensaje.");
    }
  };

  const insertEmojiInComposer = (emoji: string) => {
    const el = composerTextareaRef.current;
    if (!el) {
      setInput((prev) => `${prev}${emoji}`);
      return;
    }
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const next = `${input.slice(0, start)}${emoji}${input.slice(end)}`;
    setInput(next);
    setEmojiPickerOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const onPickComposerAttachment = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setMsgError(
        userFriendlyChatError(
          `El archivo supera el límite de ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`,
        ),
      );
      return;
    }
    setMsgError(null);
    setPendingAttachment(file);
  };

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadAttachment = async (
    messageId: string,
    attachmentId: string,
  ) => {
    setMsgError(null);
    try {
      const { blob, fileName } = await downloadConversationMessageAttachment(
        messageId,
        attachmentId,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsgError(
        userFriendlyChatError(
          e instanceof Error ? e.message : "No se pudo descargar el archivo.",
        ),
      );
    }
  };

  const confirmResolveExisting = async () => {
    if (!resolveModal.messageId || !resolveModal.decision || !resolveModal.selectedExistingId) return;
    setMsgError(null);
    try {
      await resolveConversationSharedEntity(resolveModal.messageId, {
        decision: resolveModal.decision,
        existingEntityId: resolveModal.selectedExistingId,
      });
      setResolveModal({
        open: false,
        messageId: null,
        decision: null,
        candidates: [],
        selectedExistingId: "",
      });
      if (selectedId) {
        const r = await fetchConversationMessages(selectedId, { limit: PAGE_SIZE });
        setMessages(r.messages);
      }
    } catch (e) {
      setMsgError(
        userFriendlyChatError(
          e instanceof Error ? e.message : "No se pudo resolver con entidad existente.",
        ),
      );
    }
  };

  const createConv = async () => {
    try {
      if (newType === "DIRECT") {
        if (!newOtherUserId) return;
        const d = await createConversationApi({
          type: "DIRECT",
          memberUserIds: [newOtherUserId],
        });
        setShowNew(false);
        setNewOtherUserId("");
        setNewTitle("");
        await loadList();
        setSelectedId(d.id);
      } else {
        if (!newTitle.trim() || newGroupIds.size < 1) return;
        const d = await createConversationApi({
          type: "GROUP",
          title: newTitle.trim(),
          memberUserIds: Array.from(newGroupIds),
        });
        setShowNew(false);
        setNewTitle("");
        setNewGroupIds(new Set());
        setNewOtherUserId("");
        await loadList();
        setSelectedId(d.id);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al crear");
    }
  };

  const sortedDirectoryForModal = useMemo(() => {
    return [...directory].sort((a, b) => {
      if (a.present !== b.present) return a.present ? -1 : 1;
      const byName = a.name.localeCompare(b.name, "es");
      if (byName !== 0) return byName;
      return a.email.localeCompare(b.email, "es");
    });
  }, [directory]);

  const directoryById = useMemo(
    () => new Map(directory.map((u) => [u.id, u] as const)),
    [directory],
  );

  const formatLastSeen = useCallback((iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  }, []);

  /** Si solo hay un contacto en modo directo, elegirlo automáticamente. */
  useEffect(() => {
    if (!showNew || newType !== "DIRECT" || directoryLoading) return;
    if (sortedDirectoryForModal.length !== 1) return;
    setNewOtherUserId(sortedDirectoryForModal[0]!.id);
  }, [showNew, newType, directoryLoading, sortedDirectoryForModal]);

  const selectedListItem = selectedId ? list.find((c) => c.id === selectedId) : undefined;
  const headerTitle = selectedListItem?.title ?? threadDetail?.title ?? "Conversación";
  const isThreadArchivedForMe =
    (selectedListItem?.archivedAtForMe != null && selectedListItem.archivedAtForMe !== "") ||
    threadDetail?.archivedForMe === true;

  const headerDirectPresence = useMemo(() => {
    const c = selectedListItem;
    if (!c || c.type !== "DIRECT") return null;
    const directPeerId = c.directPeerUserId ?? null;
    const peer = directPeerId ? directoryById.get(directPeerId) : undefined;
    const rowOnline = c.present === true || c.presenceStatus === "online";
    const peerOnline =
      peer != null ? peer.present === true || peer.presenceStatus === "online" : rowOnline;
    const peerLastSeenAt = peer?.lastSeenAt ?? c.lastSeenAt ?? null;
    return { peerOnline, peerLastSeenAt };
  }, [selectedListItem, directoryById]);

  const activeConversations = list.filter((c) => c.archivedAtForMe == null || c.archivedAtForMe === "");
  const archivedConversations = list.filter((c) => c.archivedAtForMe != null && c.archivedAtForMe !== "");

  const filteredActiveConversations = useMemo(
    () => activeConversations.filter((c) => conversationMatchesListFilter(c, listSearchQuery, directoryById)),
    [activeConversations, listSearchQuery, directoryById],
  );
  const filteredArchivedConversations = useMemo(
    () => archivedConversations.filter((c) => conversationMatchesListFilter(c, listSearchQuery, directoryById)),
    [archivedConversations, listSearchQuery, directoryById],
  );

  const threadSearchMatchingIds = useMemo(() => {
    const q = threadSearchQuery.trim();
    if (!q) return [];
    return messages.filter((m) => messageMatchesThreadSearch(m, q)).map((m) => m.id);
  }, [messages, threadSearchQuery]);

  const activeThreadMatchIdx = useMemo(
    () =>
      threadSearchMatchingIds.length === 0
        ? 0
        : Math.min(threadMatchIndex, threadSearchMatchingIds.length - 1),
    [threadMatchIndex, threadSearchMatchingIds],
  );
  const activeThreadMatchId =
    threadSearchMatchingIds.length === 0 ? null : threadSearchMatchingIds[activeThreadMatchIdx] ?? null;

  useEffect(() => {
    setThreadSearchQuery("");
    setThreadMatchIndex(0);
  }, [selectedId]);

  useEffect(() => {
    setThreadMatchIndex(0);
  }, [threadSearchQuery]);

  useEffect(() => {
    if (!activeThreadMatchId) return;
    const el = messageElsRef.current[activeThreadMatchId];
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [activeThreadMatchId]);

  const goThreadSearchPrev = useCallback(() => {
    setThreadMatchIndex((i) => {
      const n = threadSearchMatchingIds.length;
      if (n === 0) return 0;
      return i <= 0 ? n - 1 : i - 1;
    });
  }, [threadSearchMatchingIds]);

  const goThreadSearchNext = useCallback(() => {
    setThreadMatchIndex((i) => {
      const n = threadSearchMatchingIds.length;
      if (n === 0) return 0;
      return i >= n - 1 ? 0 : i + 1;
    });
  }, [threadSearchMatchingIds]);

  const openNewConversationModal = () => {
    setNewType("DIRECT");
    setNewOtherUserId("");
    setNewTitle("");
    setNewGroupIds(new Set());
    setShowNew(true);
  };

  const canCreateDirect =
    !directoryLoading && sortedDirectoryForModal.length > 0 && newOtherUserId.trim() !== "";
  const canCreateGroup =
    !directoryLoading &&
    sortedDirectoryForModal.length > 0 &&
    newTitle.trim() !== "" &&
    newGroupIds.size >= 1;

  const handleArchiveToggle = async (archive: boolean) => {
    if (!selectedId) return;
    if (
      archive &&
      !confirm(
        "¿Archivar esta conversación solo para usted?\n\n" +
          "• Dejará de mostrarse en su listado principal (los demás miembros no se ven afectados).\n" +
          "• Podrá verla de nuevo marcando «Mostrar archivadas» o desarchivándola desde el hilo.\n\n" +
          "¿Continuar?",
      )
    ) {
      return;
    }
    setArchiveBusy(true);
    setMsgError(null);
    setThreadFeedbackOk(null);
    try {
      await patchConversationArchiveForMe(selectedId, archive);
      const d = await fetchConversationDetail(selectedId);
      setThreadDetail(d);
      await loadList();
      setThreadFeedbackOk(
        archive
          ? "Conversación archivada para usted: dejará de verse en el listado principal hasta que marque «Mostrar archivadas»."
          : "Conversación restaurada en su bandeja principal.",
      );
    } catch (e) {
      setMsgError(
        userFriendlyChatError(
          e instanceof Error
            ? e.message
            : "No se pudo actualizar el archivo de la conversación",
        ),
      );
    } finally {
      setArchiveBusy(false);
    }
  };

  const renderListButton = (c: ConversationListItemDto) => {
    const isArchived = c.archivedAtForMe != null && c.archivedAtForMe !== "";
    const isRecentlyUpdated = recentlyUpdatedIds.has(c.id) && selectedId !== c.id;
    const directPeerId = c.directPeerUserId ?? null;
    const peer =
      c.type === "DIRECT" && directPeerId ? directoryById.get(directPeerId) : undefined;
    const rowOnline = c.present === true || c.presenceStatus === "online";
    const peerOnline =
      peer != null ? (peer.present === true || peer.presenceStatus === "online") : rowOnline;
    const peerLastSeenAt = peer?.lastSeenAt ?? c.lastSeenAt ?? null;
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => setSelectedId(c.id)}
          className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors ${
            selectedId === c.id
              ? "bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-100"
              : isRecentlyUpdated
                ? "bg-amber-50 ring-1 ring-amber-300/70 dark:bg-amber-900/20 dark:ring-amber-700/60"
              : isArchived
                ? "opacity-90 hover:bg-slate-100 dark:hover:bg-slate-800"
                : "hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  <HighlightedText text={c.title} query={listSearchQuery} />
                </span>
                {c.type === "DIRECT" ? (
                  <>
                    {peerOnline ? (
                      <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                        En línea
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-700/70 dark:text-slate-200">
                        Desconectado
                      </span>
                    )}
                    {!peerOnline && peerLastSeenAt ? (
                      <span className="min-w-0 max-w-full truncate text-[11px] text-slate-400 dark:text-slate-500">
                        Último visto {formatLastSeen(peerLastSeenAt)}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {isArchived && (
                <span
                  className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"
                  title="Archivada para usted: oculta en el listado principal"
                >
                  Archivada
                </span>
              )}
              {c.unreadCount > 0 && !isArchived && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                </span>
              )}
              {c.unreadCount > 0 && isArchived && (
                <span
                  className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white"
                  title="Mensajes sin leer"
                >
                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                </span>
              )}
            </span>
          </span>
          {c.lastMessage && (
            <span className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              <HighlightedText text={c.lastMessage.body} query={listSearchQuery} />
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[420px] flex-col gap-4 md:flex-row">
      <aside className="flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/50 md:w-[320px] md:shrink-0">
        <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Conversaciones</h2>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
            onClick={() => openNewConversationModal()}
          >
            Nueva
          </button>
        </div>
        <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={includeArchivedInList}
              onChange={(e) => setIncludeArchivedInList(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              Mostrar archivadas
              <span className="mt-0.5 block font-normal text-slate-500 dark:text-slate-500">
                Por defecto solo ve conversaciones activas en su bandeja. Las archivadas son solo para usted.
              </span>
            </span>
          </label>
        </div>
        <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <label htmlFor="conv-list-search" className="sr-only">
            Buscar conversaciones
          </label>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              id="conv-list-search"
              type="search"
              autoComplete="off"
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, título o último mensaje…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {listSearchQuery.trim() &&
            filteredActiveConversations.length === 0 &&
            filteredArchivedConversations.length === 0 &&
            list.length > 0 && (
              <p className="mb-2 px-2 text-sm text-slate-500 dark:text-slate-400">
                Ninguna conversación coincide con «{listSearchQuery.trim()}».
              </p>
            )}
          {listError && (
            <p className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {listError}
            </p>
          )}
          {list.length === 0 && !listError && (
            <p className="px-2 text-sm text-slate-500 dark:text-slate-400">
              {includeArchivedInList
                ? "No tiene conversaciones."
                : "No hay conversaciones activas. Las que archive están ocultas: marque «Mostrar archivadas»."}
            </p>
          )}
          {filteredActiveConversations.length > 0 && (
            <>
              {includeArchivedInList && filteredArchivedConversations.length > 0 && (
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Activas
                </p>
              )}
              <ul className="space-y-1">{filteredActiveConversations.map((c) => renderListButton(c))}</ul>
            </>
          )}
          {includeArchivedInList && filteredArchivedConversations.length > 0 && (
            <>
              <p className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Archivadas (solo usted)
              </p>
              <ul className="space-y-1">{filteredArchivedConversations.map((c) => renderListButton(c))}</ul>
            </>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
        {!selectedId && (
          <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
            Selecciona una conversación o crea una nueva.
          </div>
        )}
        {selectedId && (
          <>
            <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              {threadFeedbackOk && (
                <div className="mb-3">
                  <SuccessBanner message={threadFeedbackOk} onDismiss={() => setThreadFeedbackOk(null)} />
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{headerTitle}</h3>
                    {headerDirectPresence ? (
                      <>
                        {headerDirectPresence.peerOnline ? (
                          <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                            En línea
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-700/70 dark:text-slate-200">
                            Desconectado
                          </span>
                        )}
                        {!headerDirectPresence.peerOnline && headerDirectPresence.peerLastSeenAt ? (
                          <span className="min-w-0 max-w-full truncate text-[11px] text-slate-400 dark:text-slate-500">
                            Último visto {formatLastSeen(headerDirectPresence.peerLastSeenAt)}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                    {isThreadArchivedForMe && (
                      <span
                        className="inline-flex shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"
                        title="Archivada para usted: oculta en el listado principal"
                      >
                        Archivada
                      </span>
                    )}
                  </div>
                  {(selectedListItem?.type === "GROUP" || threadDetail?.type === "GROUP") &&
                    (selectedListItem?.rawTitle ?? threadDetail?.rawTitle) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedListItem?.rawTitle ?? threadDetail?.rawTitle}
                      </p>
                    )}
                  {isThreadArchivedForMe && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Solo usted la ocultó de su bandeja; el resto del equipo sigue viéndola con normalidad.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {isThreadArchivedForMe ? (
                    <button
                      type="button"
                      disabled={archiveBusy}
                      className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-900/40"
                      onClick={() => void handleArchiveToggle(false)}
                    >
                      {archiveBusy ? "…" : "Desarchivar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={archiveBusy}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      onClick={() => void handleArchiveToggle(true)}
                    >
                      {archiveBusy ? "…" : "Archivar"}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center">
                <label htmlFor="conv-thread-search" className="sr-only">
                  Buscar en esta conversación
                </label>
                <div className="relative min-w-0 flex-1 sm:max-w-md">
                  <svg
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    id="conv-thread-search"
                    type="search"
                    autoComplete="off"
                    value={threadSearchQuery}
                    onChange={(e) => setThreadSearchQuery(e.target.value)}
                    placeholder="Buscar en mensajes cargados (texto, autor, adjuntos)…"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={threadSearchMatchingIds.length === 0}
                    title="Coincidencia anterior"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={() => goThreadSearchPrev()}
                  >
                    ↑ Ant.
                  </button>
                  <button
                    type="button"
                    disabled={threadSearchMatchingIds.length === 0}
                    title="Siguiente coincidencia"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={() => goThreadSearchNext()}
                  >
                    Sig. ↓
                  </button>
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {threadSearchMatchingIds.length === 0
                      ? threadSearchQuery.trim()
                        ? "0 coincidencias"
                        : ""
                      : `${activeThreadMatchIdx + 1} / ${threadSearchMatchingIds.length}`}
                  </span>
                </div>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col">
              {loadingThread && (
                <p className="p-4 text-sm text-slate-500">Cargando mensajes…</p>
              )}
              {msgError && (
                <p className="mx-4 mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {msgError}
                </p>
              )}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {hasMoreOlder && messages.length > 0 && (
                  <div className="shrink-0 border-b border-slate-100 p-2 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={loadingMore}
                      className="text-xs text-primary-600 hover:underline disabled:opacity-50"
                      onClick={() =>
                        void loadThread(selectedId, {
                          mergeOlder: true,
                          before: messages[0]!.id,
                        })
                      }
                    >
                      {loadingMore ? "Cargando…" : "Cargar mensajes anteriores"}
                    </button>
                  </div>
                )}
                <div
                  ref={messagesScrollRef}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
                  onScroll={refreshNearBottom}
                >
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      ref={(el) => {
                        messageElsRef.current[m.id] = el;
                      }}
                      className={`rounded-lg border border-slate-200/70 bg-white/70 p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/40 ${
                        activeThreadMatchId === m.id
                          ? "ring-2 ring-amber-400 ring-offset-2 dark:ring-amber-500 dark:ring-offset-slate-900"
                          : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          <HighlightedText text={m.authorName} query={threadSearchQuery} />
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">
                        <HighlightedText text={m.body} query={threadSearchQuery} />
                      </p>
                      {m.sharedEntity && (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Entidad compartida: {m.sharedEntity.entityType}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(m.sharedEntity.myStatus)}`}>
                              {statusLabel(m.sharedEntity.myStatus)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            Compartido por <span className="font-medium">{m.sharedEntity.sourceUserName}</span> ({m.sharedEntity.sourceUserId}) desde{" "}
                            <span className="font-medium">{m.sharedEntity.sourceNodeName}</span>
                          </p>
                          <div className="mt-2 rounded border border-slate-200 bg-white p-2 text-xs dark:border-slate-600 dark:bg-slate-900">
                            {Object.entries(m.sharedEntity.snapshot ?? {}).slice(0, 6).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <span className="font-medium text-slate-600 dark:text-slate-300">{k}:</span>
                                <span className="text-slate-700 dark:text-slate-200">{String(v ?? "—")}</span>
                              </div>
                            ))}
                          </div>
                          {m.sharedEntity.myStatus === "PENDING" && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                                onClick={() => void handleResolveSharedEntity(m.id, "ACCEPT_CREATE_NEW")}
                              >
                                Crear nuevo
                              </button>
                              <button
                                type="button"
                                className="rounded bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700"
                                onClick={() => void handleResolveSharedEntity(m.id, "ACCEPT_USE_EXISTING")}
                              >
                                Usar existente
                              </button>
                              <button
                                type="button"
                                className="rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700"
                                onClick={() => void handleResolveSharedEntity(m.id, "ACCEPT_LINK_EXISTING")}
                              >
                                Vincular
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                onClick={() => void handleResolveSharedEntity(m.id, "REJECT")}
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                          {m.sharedEntity.myStatus === "ERROR" && m.sharedEntity.myErrorMessage && (
                            <p className="mt-2 text-xs text-red-600 dark:text-red-300">{m.sharedEntity.myErrorMessage}</p>
                          )}
                        </div>
                      )}
                      {(m.attachments ?? []).length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {(m.attachments ?? []).map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/60"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                                  {att.fileName}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400">
                                  {att.mimeType} · {formatBytes(att.sizeBytes)}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                onClick={() => void handleDownloadAttachment(m.id, att.id)}
                              >
                                Descargar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="relative ml-auto" data-message-actions-root="true">
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={(e) => {
                              const isClosing = actionMenuForMessageId === m.id;
                              if (isClosing) {
                                setActionMenuForMessageId(null);
                                setActionMenuPosition(null);
                                return;
                              }
                              const trigger = e.currentTarget;
                              const rect = trigger.getBoundingClientRect();
                              const menuWidth = 160;
                              const menuHeight = 150;
                              const viewportPad = 8;
                              const openUp =
                                window.innerHeight - rect.bottom < menuHeight &&
                                rect.top > menuHeight;
                              const top = openUp
                                ? Math.max(viewportPad, rect.top - menuHeight - 4)
                                : Math.min(
                                    window.innerHeight - menuHeight - viewportPad,
                                    rect.bottom + 4,
                                  );
                              const left = Math.min(
                                Math.max(rect.right - menuWidth, viewportPad),
                                window.innerWidth - menuWidth - viewportPad,
                              );
                              setActionMenuPosition({ top, left });
                              setActionMenuForMessageId(m.id);
                            }}
                            aria-label="Más acciones"
                            title="Acciones del mensaje"
                          >
                            •••
                          </button>
                          {actionMenuForMessageId === m.id && (
                            <div
                              className="fixed z-40 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                              style={
                                actionMenuPosition
                                  ? {
                                      top: `${actionMenuPosition.top}px`,
                                      left: `${actionMenuPosition.left}px`,
                                    }
                                  : undefined
                              }
                            >
                              <button
                                type="button"
                                className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                onClick={() => {
                                  setReplyToMessage({
                                    id: m.id,
                                    authorName: m.authorName,
                                    bodySnippet:
                                      m.body.length > 140 ? `${m.body.slice(0, 137)}...` : m.body,
                                  });
                                  setActionMenuForMessageId(null);
                                  setActionMenuPosition(null);
                                }}
                              >
                                Responder
                              </button>
                              <button
                                type="button"
                                className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                onClick={() => {
                                  void handleCopyMessage(m);
                                  setActionMenuForMessageId(null);
                                  setActionMenuPosition(null);
                                }}
                              >
                                Copiar
                              </button>
                              <button
                                type="button"
                                className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                onClick={() => {
                                  setReactionPickerForMessageId((prev) =>
                                    prev === m.id ? null : m.id,
                                  );
                                  setActionMenuForMessageId(null);
                                  setActionMenuPosition(null);
                                }}
                              >
                                Reaccionar
                              </button>
                              <button
                                type="button"
                                className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                onClick={() => {
                                  void handleShareMessage(m);
                                  setActionMenuForMessageId(null);
                                  setActionMenuPosition(null);
                                }}
                              >
                                Compartir
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {reactionPickerForMessageId === m.id && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/60">
                          {QUICK_REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="rounded px-2 py-1 text-sm hover:bg-white dark:hover:bg-slate-700"
                              onClick={() => void handleToggleReaction(m.id, emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                      {(m.reactions ?? []).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(m.reactions ?? []).map((r) => (
                            <button
                              key={`${m.id}-${r.emoji}`}
                              type="button"
                              className={`rounded-full border px-2 py-0.5 text-xs ${
                                r.reactedByMe
                                  ? "border-primary-400 bg-primary-100 text-primary-800 dark:border-primary-500 dark:bg-primary-900/40 dark:text-primary-200"
                                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                              onClick={() => void handleToggleReaction(m.id, r.emoji)}
                            >
                              {r.emoji} {r.count}
                            </button>
                          ))}
                        </div>
                      )}
                      <MessageMetadataBlock metadata={m.metadata ?? null} />
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </div>
              <div className="border-t border-slate-200 p-3 dark:border-slate-700">
                {threadDetail && threadDetail.members.length > 0 && (
                  <details className="mb-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/40">
                    <summary className="cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                      Menciones y cotizaciones (opcional)
                    </summary>
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Solo miembros activos del hilo. Las cotizaciones se validan al enviar (máx. 10 IDs).
                    </p>
                    <div className="mt-2 max-h-28 overflow-y-auto">
                      <p className="mb-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Mencionar a
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {threadDetail.members.map((mem) => (
                          <label
                            key={mem.userId}
                            className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                          >
                            <input
                              type="checkbox"
                              checked={mentionUserIds.has(mem.userId)}
                              onChange={() => toggleMention(mem.userId)}
                            />
                            <span>{mem.user.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="mb-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Adjuntar cotización por ID
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          className="min-w-[12rem] flex-1 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-950"
                          placeholder="Pegar UUID de cotización"
                          value={quoteIdDraft}
                          onChange={(e) => setQuoteIdDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addQuoteId();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="rounded bg-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                          onClick={addQuoteId}
                          disabled={!quoteIdDraft.trim() || quoteIdsAttached.length >= 10}
                        >
                          Añadir
                        </button>
                      </div>
                      {quoteIdsAttached.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1">
                          {quoteIdsAttached.map((id) => (
                            <li
                              key={id}
                              className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] dark:bg-primary-900/40"
                            >
                              <span className="max-w-[140px] truncate font-mono" title={id}>
                                {id.slice(0, 8)}…
                              </span>
                              <button
                                type="button"
                                className="text-primary-800 hover:underline dark:text-primary-200"
                                onClick={() => removeQuoteId(id)}
                                aria-label="Quitar"
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                )}
                {replyToMessage && (
                  <div className="mb-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs dark:border-primary-800 dark:bg-primary-950/30">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-primary-800 dark:text-primary-200">
                          Respondiendo a {replyToMessage.authorName}
                        </p>
                        <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                          {replyToMessage.bodySnippet}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-primary-700 underline dark:text-primary-300"
                        onClick={() => setReplyToMessage(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                {pendingAttachment && (
                  <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                        Archivo: {pendingAttachment.name}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {pendingAttachment.type || "application/octet-stream"} · {formatBytes(pendingAttachment.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-slate-700 underline dark:text-slate-300"
                      onClick={() => {
                        setPendingAttachment(null);
                        if (composerFileInputRef.current) composerFileInputRef.current.value = "";
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={composerFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => onPickComposerAttachment(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="self-end rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    title="Adjuntar archivo"
                    aria-label="Adjuntar archivo"
                    onClick={() => composerFileInputRef.current?.click()}
                  >
                    📎
                  </button>
                  <div className="relative flex-1">
                    <AutocorrectTextarea
                      ref={composerTextareaRef}
                      wrapperClassName="flex-1 min-w-0"
                      className="min-h-[44px] w-full resize-none rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                      placeholder="Escribe un mensaje…"
                      rows={2}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="absolute bottom-2 right-2 rounded-md p-1 text-base hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Insertar emoji"
                      title="Emoji"
                      onClick={() => setEmojiPickerOpen((v) => !v)}
                    >
                      😊
                    </button>
                    {emojiPickerOpen && (
                      <div className="absolute bottom-12 right-0 z-20 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <div className="grid grid-cols-8 gap-1">
                          {COMPOSER_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="rounded p-1.5 text-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={() => insertEmojiInComposer(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="self-end rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                    disabled={sending || (!input.trim() && !pendingAttachment)}
                    onClick={() => void send()}
                  >
                    Enviar
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-50 p-6 shadow-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Nueva conversación
            </h3>
            <div className="mt-4 flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
                  checked={newType === "DIRECT"}
                  onChange={() => {
                    setNewType("DIRECT");
                    setNewGroupIds(new Set());
                  }}
                />
                Una persona
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  className="h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
                  checked={newType === "GROUP"}
                  onChange={() => {
                    setNewType("GROUP");
                    setNewOtherUserId("");
                  }}
                />
                Grupo
              </label>
            </div>
            {newType === "DIRECT" && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  ¿Con quién quieres hablar?
                </p>
                {directoryLoading ? (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Cargando contactos…</p>
                ) : sortedDirectoryForModal.length === 0 || directoryError ? (
                  <DirectoryModalEmptyBlock
                    directoryError={directoryError}
                    showCompanionHint={showCompanionHint}
                    canAccessUsers={canAccessUsers}
                    onRetry={() => void loadDirectoryForModal()}
                  />
                ) : (
                  <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                    {sortedDirectoryForModal.map((u) => {
                      const selected = newOtherUserId === u.id;
                      return (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => setNewOtherUserId(u.id)}
                            className={`flex w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                              selected
                                ? "border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-950/40"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
                            }`}
                          >
                            <span className="flex w-full flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
                              {u.present ? (
                                <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                                  En línea
                                </span>
                              ) : (
                                <span className="inline-flex shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-700/70 dark:text-slate-200">
                                  Desconectado
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{u.email}</span>
                            {!u.present && u.lastSeenAt ? (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                Último visto {formatLastSeen(u.lastSeenAt)}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            {newType === "GROUP" && (
              <>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                    Nombre del grupo
                  </label>
                  <input
                    type="text"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-primary-500 dark:focus:ring-primary-500"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej. Proyecto X"
                  />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Miembros</p>
                  {directoryLoading ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cargando contactos…</p>
                  ) : sortedDirectoryForModal.length === 0 || directoryError ? (
                    <DirectoryModalEmptyBlock
                      directoryError={directoryError}
                      showCompanionHint={showCompanionHint}
                      canAccessUsers={canAccessUsers}
                      onRetry={() => void loadDirectoryForModal()}
                    />
                  ) : (
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-0.5">
                      {sortedDirectoryForModal.map((u) => (
                        <li key={u.id}>
                          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800/60">
                            <input
                              type="checkbox"
                              className="mt-1 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
                              checked={newGroupIds.has(u.id)}
                              onChange={() => {
                                setNewGroupIds((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(u.id)) n.delete(u.id);
                                  else n.add(u.id);
                                  return n;
                                });
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
                                {u.present ? (
                                  <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                                    En línea
                                  </span>
                                ) : (
                                  <span className="inline-flex shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-700/70 dark:text-slate-200">
                                    Desconectado
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                                {u.email}
                              </span>
                              {!u.present && u.lastSeenAt ? (
                                <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
                                  Último visto {formatLastSeen(u.lastSeenAt)}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                onClick={() => setShowNew(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                disabled={newType === "DIRECT" ? !canCreateDirect : !canCreateGroup}
                onClick={() => void createConv()}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
      <Modal
        open={resolveModal.open}
        onClose={() =>
          setResolveModal({
            open: false,
            messageId: null,
            decision: null,
            candidates: [],
            selectedExistingId: "",
          })
        }
        title={
          resolveModal.decision === "ACCEPT_LINK_EXISTING"
            ? "Vincular entidad existente"
            : "Usar entidad existente"
        }
        maxWidth="md"
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          Seleccione una coincidencia existente para resolver manualmente. No se integra nada automáticamente.
        </p>
        {resolveModal.candidates.length === 0 ? (
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
            No se detectaron coincidencias. Puede cerrar y elegir “Crear nuevo” o “Rechazar”.
          </p>
        ) : (
          <select
            className="input-field"
            value={resolveModal.selectedExistingId}
            onChange={(e) =>
              setResolveModal((prev) => ({ ...prev, selectedExistingId: e.target.value }))
            }
          >
            {resolveModal.candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.id})
              </option>
            ))}
          </select>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setResolveModal({
                open: false,
                messageId: null,
                decision: null,
                candidates: [],
                selectedExistingId: "",
              })
            }
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!resolveModal.selectedExistingId}
            onClick={() => void confirmResolveExisting()}
          >
            Confirmar
          </button>
        </div>
      </Modal>
      <Modal
        open={forwardModal.open}
        onClose={() =>
          setForwardModal({
            open: false,
            sourceMessage: null,
            destinationMode: "CONVERSATION",
            selectedConversationId: "",
            selectedUserId: "",
            note: "",
            loading: false,
          })
        }
        title="Compartir mensaje"
        maxWidth="md"
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Reenvíe este mensaje dentro del sistema a otra conversación o a otro usuario.
        </p>
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {forwardModal.sourceMessage?.body || "(sin texto)"}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Destino</span>
            <select
              className="input-field"
              value={forwardModal.destinationMode}
              onChange={(e) =>
                setForwardModal((prev) => ({
                  ...prev,
                  destinationMode: e.target.value as "CONVERSATION" | "USER",
                }))
              }
            >
              <option value="CONVERSATION">Conversación</option>
              <option value="USER">Usuario interno</option>
            </select>
          </label>
          {forwardModal.destinationMode === "CONVERSATION" ? (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Conversación</span>
              <select
                className="input-field"
                value={forwardModal.selectedConversationId}
                onChange={(e) =>
                  setForwardModal((prev) => ({ ...prev, selectedConversationId: e.target.value }))
                }
              >
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Usuario</span>
              <select
                className="input-field"
                value={forwardModal.selectedUserId}
                onChange={(e) =>
                  setForwardModal((prev) => ({ ...prev, selectedUserId: e.target.value }))
                }
              >
                {directory.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setForwardModal({
                open: false,
                sourceMessage: null,
                destinationMode: "CONVERSATION",
                selectedConversationId: "",
                selectedUserId: "",
                note: "",
                loading: false,
              })
            }
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={
              forwardModal.loading ||
              (forwardModal.destinationMode === "CONVERSATION"
                ? !forwardModal.selectedConversationId
                : !forwardModal.selectedUserId)
            }
            onClick={() => void confirmForwardMessage()}
          >
            Reenviar
          </button>
        </div>
      </Modal>
    </div>
  );
}
