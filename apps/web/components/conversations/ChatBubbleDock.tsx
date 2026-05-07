"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ConversationListItemDto,
  type ConversationMessageDto,
  createConversationApi,
  downloadConversationMessageAttachment,
  fetchConversationMessages,
  fetchConversationsDirectoryUsers,
  fetchConversationsList,
  getMe,
  postConversationFileMessage,
  postConversationMessage,
  postConversationRead,
  toggleConversationMessageReaction,
} from "../../lib/api";
import { conversationsRealtime } from "../../lib/conversations-realtime";
import { SUITE_AGENT_OPEN_PANEL_EVENT } from "../../lib/suite-agent-chat";
import { SuiteAgentPanel } from "../suite-agent/SuiteAgentPanel";
import { MessageMetadataBlock } from "./MessageMetadataBlock";
import { AutocorrectTextarea } from "../input/AutocorrectTextarea";

const LS_KEY = "chatBubbleDock.v1";
const LIST_PREVIEW_N = 10;
const POLL_LIST_MS = 25_000;
const POLL_MESSAGES_MS = 12_000;
const PAGE_SIZE = 50;
const BUBBLE_SIZE = 56;
const PANEL_W = 380;
const PANEL_H = 540;
const DEFAULT_RIGHT = 24;
const DEFAULT_BOTTOM = 24;

const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
const COMPOSER_EMOJIS = ["😀", "😂", "👍", "🙏", "🎉", "✅", "📎", "🔥"] as const;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function userFriendlyDockError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("límite") || m.includes("mb")) {
    return "El archivo supera el tamaño permitido (máx. 15 MB).";
  }
  if (m.includes("descargar")) return "No se pudo descargar el archivo.";
  if (m.includes("reaccion")) return "No se pudo aplicar la reacción.";
  return raw;
}

/** Misma lógica que en /conversaciones para entidades compartidas vía socket. */
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

type DockPersist = {
  hidden: boolean;
  panelOpen: boolean;
  right: number;
  bottom: number;
};

function loadPersist(): DockPersist {
  if (typeof window === "undefined") {
    return {
      hidden: false,
      panelOpen: false,
      right: DEFAULT_RIGHT,
      bottom: DEFAULT_BOTTOM,
    };
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) throw new Error("empty");
    const p = JSON.parse(raw) as Partial<DockPersist>;
    return {
      hidden: Boolean(p.hidden),
      panelOpen: Boolean(p.panelOpen),
      right: typeof p.right === "number" && Number.isFinite(p.right) ? p.right : DEFAULT_RIGHT,
      bottom:
        typeof p.bottom === "number" && Number.isFinite(p.bottom) ? p.bottom : DEFAULT_BOTTOM,
    };
  } catch {
    return {
      hidden: false,
      panelOpen: false,
      right: DEFAULT_RIGHT,
      bottom: DEFAULT_BOTTOM,
    };
  }
}

function savePersist(p: DockPersist) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

type DragKind = "bubble" | "header";

export function ChatBubbleDock() {
  const [hidden, setHidden] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [right, setRight] = useState(DEFAULT_RIGHT);
  const [bottom, setBottom] = useState(DEFAULT_BOTTOM);
  const [hydrated, setHydrated] = useState(false);

  const [list, setList] = useState<ConversationListItemDto[]>([]);
  const [dockView, setDockView] = useState<"list" | "thread" | "sam">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessageDto[]>([]);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<{
    id: string;
    authorName: string;
    bodySnippet: string;
  } | null>(null);
  const [reactionPickerForMessageId, setReactionPickerForMessageId] = useState<string | null>(null);
  const [actionMenuForMessageId, setActionMenuForMessageId] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [dockFeedbackOk, setDockFeedbackOk] = useState<string | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardSource, setForwardSource] = useState<ConversationMessageDto | null>(null);
  const [forwardMode, setForwardMode] = useState<"CONVERSATION" | "DIRECT">("CONVERSATION");
  const [forwardConvId, setForwardConvId] = useState("");
  const [forwardUserId, setForwardUserId] = useState("");
  const [forwardDirectory, setForwardDirectory] = useState<{ id: string; name: string }[]>([]);
  const [forwardConvOptions, setForwardConvOptions] = useState<ConversationListItemDto[]>([]);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [olderLoadedCount, setOlderLoadedCount] = useState(0);
  const olderLoadedCountRef = useRef(0);
  olderLoadedCountRef.current = olderLoadedCount;

  const bottomRef = useRef<HTMLDivElement>(null);
  const composerFileInputRef = useRef<HTMLInputElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const panelOpenRef = useRef(false);
  const dockViewRef = useRef<"list" | "thread" | "sam">("list");
  const viewerUserIdRef = useRef<string | null>(null);
  const listPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dragRef = useRef<{
    kind: DragKind;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    width: number;
    height: number;
  } | null>(null);
  /** Evita captura de puntero colgada (Electron/Windows si el up ocurre fuera de la ventana). */
  const pointerCaptureElRef = useRef<HTMLElement | null>(null);
  const activeDragPointerIdRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const positionRef = useRef({ right: DEFAULT_RIGHT, bottom: DEFAULT_BOTTOM });

  useEffect(() => {
    const p = loadPersist();
    setHidden(p.hidden);
    setPanelOpen(p.panelOpen);
    setRight(p.right);
    setBottom(p.bottom);
    positionRef.current = { right: p.right, bottom: p.bottom };
    setHydrated(true);
  }, []);

  useEffect(() => {
    positionRef.current = { right, bottom };
  }, [right, bottom]);

  useEffect(() => {
    const endDragFromWindow = () => {
      if (!dragRef.current) return;
      const el = pointerCaptureElRef.current;
      const pid = activeDragPointerIdRef.current;
      if (el != null && pid != null) {
        try {
          if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid);
        } catch {
          /* */
        }
      }
      pointerCaptureElRef.current = null;
      activeDragPointerIdRef.current = null;
      dragRef.current = null;
      dragMovedRef.current = false;
      const p = positionRef.current;
      savePersist({
        hidden,
        panelOpen,
        right: p.right,
        bottom: p.bottom,
      });
    };
    window.addEventListener("pointerup", endDragFromWindow);
    window.addEventListener("pointercancel", endDragFromWindow);
    return () => {
      window.removeEventListener("pointerup", endDragFromWindow);
      window.removeEventListener("pointercancel", endDragFromWindow);
    };
  }, [hidden, panelOpen]);

  useEffect(() => {
    if (!hydrated) return;
    savePersist({ hidden, panelOpen, right, bottom });
  }, [hydrated, hidden, panelOpen, right, bottom]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);
  useEffect(() => {
    dockViewRef.current = dockView;
  }, [dockView]);

  useEffect(() => {
    if (!actionMenuForMessageId) return;
    const close = () => {
      setActionMenuForMessageId(null);
      setActionMenuPosition(null);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [actionMenuForMessageId]);

  useEffect(() => {
    if (!dockFeedbackOk) return;
    const t = window.setTimeout(() => setDockFeedbackOk(null), 3200);
    return () => window.clearTimeout(t);
  }, [dockFeedbackOk]);

  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      try {
        const me = await getMe();
        viewerUserIdRef.current = me.id;
      } catch {
        viewerUserIdRef.current = null;
      }
    })();
  }, [hydrated]);

  const loadList = useCallback(async () => {
    try {
      const r = await fetchConversationsList();
      setList(r.conversations);
    } catch {
      /* token inválido o red */
    }
  }, []);

  useEffect(() => {
    if (!hydrated || hidden) return;
    void loadList();
    listPollRef.current = setInterval(() => void loadList(), POLL_LIST_MS);
    return () => {
      if (listPollRef.current) clearInterval(listPollRef.current);
    };
  }, [hydrated, hidden, loadList]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  useEffect(() => {
    const unsub = conversationsRealtime.onMessageNew((event) => {
      void loadList();
      if (
        !selectedIdRef.current ||
        event.conversationId !== selectedIdRef.current ||
        !panelOpenRef.current ||
        dockViewRef.current !== "thread"
      ) {
        return;
      }
      const incoming = enrichRealtimeSharedEntityForViewer(event.message, viewerUserIdRef.current);
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
      void postConversationRead(event.conversationId).catch(() => undefined);
      scrollToBottom();
    });
    const unsubR = conversationsRealtime.onReaction((event) => {
      if (
        !selectedIdRef.current ||
        event.conversationId !== selectedIdRef.current ||
        !panelOpenRef.current ||
        dockViewRef.current !== "thread"
      ) {
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === event.messageId ? { ...m, reactions: event.reactions } : m)),
      );
    });
    return () => {
      unsub();
      unsubR();
    };
  }, [loadList]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      setLoadingThread(true);
      setMsgError(null);
      try {
        const r = await fetchConversationMessages(conversationId, { limit: PAGE_SIZE });
        setOlderLoadedCount(0);
        setMessages(r.messages);
        await postConversationRead(conversationId);
        void loadList();
        scrollToBottom();
      } catch (e) {
        setMsgError(e instanceof Error ? e.message : "Error al cargar mensajes");
      } finally {
        setLoadingThread(false);
      }
    },
    [loadList],
  );

  useEffect(() => {
    if (!panelOpen || dockView !== "thread" || !selectedId) {
      setMessages([]);
      return;
    }
    void loadThread(selectedId);
  }, [dockView, selectedId, panelOpen, loadThread]);

  useEffect(() => {
    if (!panelOpen || dockView !== "thread" || !selectedId) return;
    conversationsRealtime.joinConversation(selectedId);
    return () => {
      conversationsRealtime.leaveConversation(selectedId);
    };
  }, [panelOpen, dockView, selectedId]);

  useEffect(() => {
    const onOpenSam = () => {
      setHidden(false);
      setPanelOpen(true);
      setDockView("sam");
      setSelectedId(null);
      setMessages([]);
      setInput("");
      setPendingAttachment(null);
      setReplyToMessage(null);
      setReactionPickerForMessageId(null);
      setEmojiPickerOpen(false);
      if (composerFileInputRef.current) composerFileInputRef.current.value = "";
      void loadList();
    };
    window.addEventListener(SUITE_AGENT_OPEN_PANEL_EVENT, onOpenSam);
    return () => window.removeEventListener(SUITE_AGENT_OPEN_PANEL_EVENT, onOpenSam);
  }, [loadList]);

  useEffect(() => {
    if (msgPollRef.current) {
      clearInterval(msgPollRef.current);
      msgPollRef.current = null;
    }
    if (!selectedId || !panelOpen || dockView !== "thread") return;
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
          if (lastLocal === lastRemote) return prev;
          return r.messages;
        });
        await postConversationRead(selectedId);
        void loadList();
      } catch {
        /* ignore */
      }
    }, POLL_MESSAGES_MS);
    return () => {
      if (msgPollRef.current) clearInterval(msgPollRef.current);
    };
  }, [selectedId, panelOpen, dockView, loadList]);

  const totalUnread = list.reduce((acc, c) => acc + (c.unreadCount > 0 ? c.unreadCount : 0), 0);
  const previewList = list.slice(0, LIST_PREVIEW_N);
  const selectedConv = selectedId ? list.find((c) => c.id === selectedId) : undefined;
  const headerTitle =
    dockView === "sam" ? "SAM" : dockView === "thread" ? (selectedConv?.title ?? "Chat") : "Mensajes";

  const goToList = () => {
    setDockView("list");
    setSelectedId(null);
    setMessages([]);
    setInput("");
    setPendingAttachment(null);
    setReplyToMessage(null);
    setReactionPickerForMessageId(null);
    setActionMenuForMessageId(null);
    setActionMenuPosition(null);
    setEmojiPickerOpen(false);
    if (composerFileInputRef.current) composerFileInputRef.current.value = "";
  };

  const clampPosition = useCallback((rVal: number, bVal: number, w: number, h: number) => {
    const maxR = Math.max(8, window.innerWidth - w - 8);
    const maxB = Math.max(8, window.innerHeight - h - 8);
    return {
      right: Math.min(maxR, Math.max(8, rVal)),
      bottom: Math.min(maxB, Math.max(8, bVal)),
    };
  }, []);

  const onPointerDownDrag = (e: React.PointerEvent, kind: DragKind) => {
    if (e.button !== 0) return;
    dragMovedRef.current = false;
    const w = kind === "bubble" ? BUBBLE_SIZE : PANEL_W;
    const h = kind === "bubble" ? BUBBLE_SIZE : PANEL_H;
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startRight: positionRef.current.right,
      startBottom: positionRef.current.bottom,
      width: w,
      height: h,
    };
    const el = e.currentTarget as HTMLElement;
    pointerCaptureElRef.current = el;
    activeDragPointerIdRef.current = e.pointerId;
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMoveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 6) dragMovedRef.current = true;
    const nextR = d.startRight - dx;
    const nextB = d.startBottom - dy;
    const c = clampPosition(nextR, nextB, d.width, d.height);
    positionRef.current = c;
    setRight(c.right);
    setBottom(c.bottom);
  };

  const onPointerUpDrag = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      pointerCaptureElRef.current = null;
      activeDragPointerIdRef.current = null;
      dragRef.current = null;
      const p = positionRef.current;
      savePersist({
        hidden,
        panelOpen,
        right: p.right,
        bottom: p.bottom,
      });
    }
  };

  const openPanel = () => {
    setPanelOpen(true);
    setDockView("list");
    void loadList();
  };

  const minimizePanel = () => {
    setPanelOpen(false);
    setDockView("list");
    setSelectedId(null);
    setMessages([]);
    setInput("");
    setPendingAttachment(null);
    setReplyToMessage(null);
    setReactionPickerForMessageId(null);
    setActionMenuForMessageId(null);
    setActionMenuPosition(null);
    setForwardOpen(false);
    setForwardSource(null);
    setEmojiPickerOpen(false);
    if (composerFileInputRef.current) composerFileInputRef.current.value = "";
  };

  const onPickComposerAttachment = (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setMsgError(
        userFriendlyDockError(
          `El archivo supera el límite de ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`,
        ),
      );
      return;
    }
    setMsgError(null);
    setPendingAttachment(file);
  };

  const handleDownloadAttachment = async (messageId: string, attachmentId: string) => {
    setMsgError(null);
    try {
      const { blob, fileName } = await downloadConversationMessageAttachment(messageId, attachmentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsgError(userFriendlyDockError(e instanceof Error ? e.message : "Error al descargar"));
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setMsgError(null);
    try {
      const out = await toggleConversationMessageReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === out.messageId ? { ...m, reactions: out.reactions } : m)),
      );
      setReactionPickerForMessageId(null);
    } catch (e) {
      setMsgError(userFriendlyDockError(e instanceof Error ? e.message : "Error"));
    }
  };

  const openMessageActionMenu = (e: React.MouseEvent, messageId: string) => {
    const isClosing = actionMenuForMessageId === messageId;
    if (isClosing) {
      setActionMenuForMessageId(null);
      setActionMenuPosition(null);
      return;
    }
    const trigger = e.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 172;
    const menuHeight = 200;
    const viewportPad = 8;
    const openUp =
      window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight;
    const top = openUp
      ? Math.max(viewportPad, rect.top - menuHeight - 4)
      : Math.min(window.innerHeight - menuHeight - viewportPad, rect.bottom + 4);
    const left = Math.min(
      Math.max(rect.right - menuWidth, viewportPad),
      window.innerWidth - menuWidth - viewportPad,
    );
    setActionMenuPosition({ top, left });
    setActionMenuForMessageId(messageId);
  };

  const handleCopyMessageBody = async (m: ConversationMessageDto) => {
    try {
      await navigator.clipboard.writeText(m.body ?? "");
      setDockFeedbackOk("Mensaje copiado.");
      setActionMenuForMessageId(null);
      setActionMenuPosition(null);
    } catch {
      setMsgError("No se pudo copiar.");
    }
  };

  const openForwardModal = async (m: ConversationMessageDto) => {
    setActionMenuForMessageId(null);
    setActionMenuPosition(null);
    setForwardSource(m);
    setForwardOpen(true);
    setForwardLoading(true);
    setMsgError(null);
    try {
      const [convRes, dirRes] = await Promise.all([
        fetchConversationsList(),
        fetchConversationsDirectoryUsers(),
      ]);
      setForwardConvOptions(convRes.conversations);
      const targets = convRes.conversations.filter((c) => c.id !== selectedId);
      setForwardConvId(targets[0]?.id ?? "");
      setForwardDirectory(dirRes.users.map((u) => ({ id: u.id, name: u.name })));
      setForwardUserId(dirRes.users[0]?.id ?? "");
      setForwardMode("CONVERSATION");
    } catch {
      setMsgError("No se pudo cargar destinos para reenviar.");
      setForwardOpen(false);
      setForwardSource(null);
    } finally {
      setForwardLoading(false);
    }
  };

  const confirmForwardMessage = async () => {
    if (!forwardSource) return;
    setMsgError(null);
    try {
      let conversationId = "";
      if (forwardMode === "CONVERSATION") {
        conversationId = forwardConvId;
      } else {
        if (!forwardUserId) return;
        const created = await createConversationApi({
          type: "DIRECT",
          memberUserIds: [forwardUserId],
        });
        conversationId = created.id;
      }
      if (!conversationId) return;
      const prefix = `Reenviado de ${forwardSource.authorName}`;
      const forwardedBody = forwardSource.body?.trim() || "(sin texto)";
      await postConversationMessage(conversationId, {
        body: `${prefix}:\n${forwardedBody}`,
      });
      setForwardOpen(false);
      setForwardSource(null);
      setDockFeedbackOk("Reenviado.");
      void loadList();
    } catch {
      setMsgError("No se pudo reenviar el mensaje.");
    }
  };

  const send = async () => {
    if (!selectedId || sending || (!input.trim() && !pendingAttachment)) return;
    setSending(true);
    setMsgError(null);
    try {
      const replyId = replyToMessage?.id;
      if (pendingAttachment) {
        await postConversationFileMessage(selectedId, {
          file: pendingAttachment,
          body: input.trim() || undefined,
          ...(replyId ? { replyToMessageId: replyId } : {}),
        });
      } else {
        await postConversationMessage(selectedId, {
          body: input.trim(),
          ...(replyId ? { replyToMessageId: replyId } : {}),
        });
      }
      setInput("");
      setPendingAttachment(null);
      setReplyToMessage(null);
      setReactionPickerForMessageId(null);
      setEmojiPickerOpen(false);
      if (composerFileInputRef.current) composerFileInputRef.current.value = "";
      const r = await fetchConversationMessages(selectedId, { limit: PAGE_SIZE });
      setMessages((prev) => {
        if (olderLoadedCountRef.current > 0) {
          const newOnes = r.messages.filter((nm) => !prev.some((p) => p.id === nm.id));
          return newOnes.length ? [...prev, ...newOnes] : prev;
        }
        return r.messages;
      });
      await postConversationRead(selectedId);
      void loadList();
      scrollToBottom();
    } catch (err) {
      setMsgError(userFriendlyDockError(err instanceof Error ? err.message : "Error al enviar"));
    } finally {
      setSending(false);
    }
  };

  if (!hydrated) return null;

  return (
    <div className="no-print pointer-events-none fixed inset-0 z-[30]">
      {/* Pestaña para restaurar cuando está oculto */}
      {hidden && (
        <button
          type="button"
          className="pointer-events-auto absolute right-0 top-1/2 z-[30] -translate-y-1/2 rounded-l-lg border border-slate-300 bg-white px-2 py-3 text-xs font-medium text-slate-700 shadow-md hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          onClick={() => {
            setHidden(false);
            const p = loadPersist();
            savePersist({
              hidden: false,
              panelOpen: p.panelOpen,
              right: p.right,
              bottom: p.bottom,
            });
          }}
          aria-label="Mostrar conversaciones"
        >
          Chat
        </button>
      )}

      {!hidden && (
        <>
          {!panelOpen && (
            <button
              type="button"
              className="pointer-events-auto fixed flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary-500 bg-primary-600 text-white shadow-lg transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              style={{ right, bottom }}
              aria-label="Abrir mensajes (equipo y SAM)"
              title="Mensajes: conversaciones del equipo y asistente SAM en el mismo panel"
              onPointerDown={(e) => onPointerDownDrag(e, "bubble")}
              onPointerMove={onPointerMoveDrag}
              onPointerUp={(e) => {
                onPointerUpDrag(e);
                if (!dragMovedRef.current) openPanel();
              }}
              onPointerCancel={onPointerUpDrag}
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {totalUnread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </button>
          )}

          {panelOpen && (
            <div
              className="pointer-events-auto fixed flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
              style={{
                right,
                bottom,
                width: PANEL_W,
                height: PANEL_H,
                maxHeight: "min(560px, calc(100vh - 24px))",
              }}
              role="dialog"
              aria-label="Mensajes y SAM"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800/80">
                {dockView !== "list" ? (
                  <button
                    type="button"
                    className="shrink-0 rounded p-1.5 text-sm text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                    onClick={() => goToList()}
                    aria-label="Volver a la lista"
                    title="Volver"
                  >
                    ←
                  </button>
                ) : (
                  <span className="w-8 shrink-0" aria-hidden />
                )}
                <div
                  className="min-w-0 flex-1 cursor-grab py-1 active:cursor-grabbing"
                  onPointerDown={(e) => onPointerDownDrag(e, "header")}
                  onPointerMove={onPointerMoveDrag}
                  onPointerUp={onPointerUpDrag}
                  onPointerCancel={onPointerUpDrag}
                >
                  <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {headerTitle}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                    title="Minimizar"
                    onClick={() => minimizePanel()}
                    aria-label="Minimizar"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                    title="Ocultar burbuja"
                    onClick={() => {
                      setPanelOpen(false);
                      setDockView("list");
                      setSelectedId(null);
                      setMessages([]);
                      setInput("");
                      setPendingAttachment(null);
                      setReplyToMessage(null);
                      setReactionPickerForMessageId(null);
                      setActionMenuForMessageId(null);
                      setActionMenuPosition(null);
                      setForwardOpen(false);
                      setForwardSource(null);
                      setEmojiPickerOpen(false);
                      if (composerFileInputRef.current) composerFileInputRef.current.value = "";
                      setHidden(true);
                    }}
                    aria-label="Ocultar"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {dockView === "list" && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                      <li className="mb-1">
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg border border-violet-200/80 bg-violet-50/80 px-2 py-2.5 text-left text-sm hover:bg-violet-100/90 dark:border-violet-800/60 dark:bg-violet-950/40 dark:hover:bg-violet-950/70"
                          onClick={() => {
                            setDockView("sam");
                            setSelectedId(null);
                            setMessages([]);
                          }}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-600 text-base text-white shadow-sm">
                            ✦
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-slate-900 dark:text-slate-100">SAM</span>
                            <span className="block text-xs text-slate-600 dark:text-slate-400">Asistente IA</span>
                          </span>
                        </button>
                      </li>
                      {previewList.length === 0 && (
                        <li className="px-2 py-4 text-center text-sm text-slate-500 dark:text-slate-300">
                          No hay conversaciones con el equipo.{" "}
                          <Link
                            href="/conversaciones"
                            className="text-primary-600 hover:underline dark:text-primary-400"
                            onClick={() => setPanelOpen(false)}
                          >
                            Nueva conversación
                          </Link>
                        </li>
                      )}
                      {previewList.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="flex w-full flex-col rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => {
                              setDockView("thread");
                              setSelectedId(c.id);
                            }}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
                                {c.title}
                              </span>
                              {c.unreadCount > 0 && (
                                <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                                </span>
                              )}
                            </span>
                            {c.lastMessage && (
                              <span className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                {c.lastMessage.body}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="shrink-0 border-t border-slate-100 px-3 py-2 text-center dark:border-slate-800">
                      <Link
                        href="/conversaciones"
                        className="text-[10px] text-slate-400 hover:text-primary-600 hover:underline dark:text-slate-500 dark:hover:text-primary-400"
                        onClick={() => setPanelOpen(false)}
                      >
                        Administrar conversaciones (pantalla completa)
                      </Link>
                    </div>
                  </div>
                )}

                {dockView === "thread" && selectedId && (
                  <>
                    {loadingThread && (
                      <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">Cargando…</p>
                    )}
                    {msgError && (
                      <p className="mx-2 mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-200">
                        {msgError}
                      </p>
                    )}
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
                      {messages.map((m) => (
                        <div key={m.id} className="text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {m.authorName}
                              </span>
                              <span>
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 rounded px-1.5 py-0.5 text-sm leading-none text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                              aria-label="Más acciones"
                              title="Más"
                              onClick={(e) => openMessageActionMenu(e, m.id)}
                            >
                              ⋮
                            </button>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">
                            {m.body}
                          </p>
                          {(m.attachments?.length ?? 0) > 0 && (
                            <div className="mt-1.5 space-y-1">
                              {(m.attachments ?? []).map((att) => (
                                <div
                                  key={att.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800/60"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                                      {att.fileName}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {att.mimeType} · {formatBytes(att.sizeBytes)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    className="shrink-0 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                    onClick={() => void handleDownloadAttachment(m.id, att.id)}
                                  >
                                    Descargar
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <MessageMetadataBlock metadata={m.metadata ?? null} compact />
                          {reactionPickerForMessageId === m.id && (
                            <div className="mt-1.5 flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
                              {QUICK_REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className="rounded px-1.5 py-0.5 text-base hover:bg-white dark:hover:bg-slate-700"
                                  onClick={() => void handleToggleReaction(m.id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                          {(m.reactions ?? []).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {(m.reactions ?? []).map((r) => (
                                <button
                                  key={`${m.id}-${r.emoji}`}
                                  type="button"
                                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
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
                        </div>
                      ))}
                      <div ref={bottomRef} />
                    </div>
                    <div className="shrink-0 border-t border-slate-200 p-2 dark:border-slate-700">
                      {dockFeedbackOk && (
                        <p className="mb-2 rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-900 dark:bg-emerald-900/35 dark:text-emerald-100">
                          {dockFeedbackOk}
                        </p>
                      )}
                      <p className="mb-1.5 px-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                        Menciones, compartir entidades y más:{" "}
                        <Link
                          href="/conversaciones"
                          className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                          onClick={() => setPanelOpen(false)}
                        >
                          vista completa
                        </Link>
                        .
                      </p>
                      {replyToMessage && (
                        <div className="mb-2 rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 text-[10px] dark:border-primary-800 dark:bg-primary-950/30">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-primary-800 dark:text-primary-200">
                                → {replyToMessage.authorName}
                              </p>
                              <p className="mt-0.5 text-slate-700 dark:text-slate-300">
                                {replyToMessage.bodySnippet}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 text-primary-700 underline dark:text-primary-300"
                              onClick={() => setReplyToMessage(null)}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                      {pendingAttachment && (
                        <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] dark:border-slate-700 dark:bg-slate-800/50">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                              📎 {pendingAttachment.name}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              {formatBytes(pendingAttachment.size)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 text-slate-600 underline dark:text-slate-400"
                            onClick={() => {
                              setPendingAttachment(null);
                              if (composerFileInputRef.current) composerFileInputRef.current.value = "";
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      )}
                      <input
                        ref={composerFileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => onPickComposerAttachment(e.target.files?.[0])}
                      />
                      <div className="flex gap-1">
                        <div className="relative flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="shrink-0 self-end rounded border border-slate-300 bg-white px-2 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
                              title="Adjuntar archivo"
                              aria-label="Adjuntar archivo"
                              onClick={() => composerFileInputRef.current?.click()}
                            >
                              📎
                            </button>
                            <div className="relative min-w-0 flex-1">
                              <AutocorrectTextarea
                                wrapperClassName="min-w-0 w-full"
                                className="min-h-[36px] w-full resize-none rounded border border-slate-300 px-2 py-1.5 pr-8 text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                                rows={2}
                                placeholder="Mensaje… (Enter envía)"
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
                                className="absolute bottom-1.5 right-1.5 rounded p-0.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                                aria-label="Emojis"
                                title="Emojis"
                                onClick={() => setEmojiPickerOpen((v) => !v)}
                              >
                                😊
                              </button>
                            </div>
                          </div>
                          {emojiPickerOpen && (
                            <div className="absolute bottom-full right-0 z-20 mb-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                              <div className="grid grid-cols-8 gap-0.5">
                                {COMPOSER_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="rounded p-1 text-base hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={() => {
                                      setInput((prev) => prev + emoji);
                                      setEmojiPickerOpen(false);
                                    }}
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
                          className="self-end rounded bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                          disabled={sending || (!input.trim() && !pendingAttachment)}
                          onClick={() => void send()}
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {dockView === "sam" && (
                  <SuiteAgentPanel embedded className="min-h-0 border-t border-slate-100 dark:border-slate-800" />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {actionMenuForMessageId && actionMenuPosition && (
        <div
          className="pointer-events-auto fixed z-[45] w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-600 dark:bg-slate-900"
          style={{ top: actionMenuPosition.top, left: actionMenuPosition.left }}
          role="menu"
        >
          {(() => {
            const m = messages.find((x) => x.id === actionMenuForMessageId);
            if (!m) return null;
            return (
              <>
                <button
                  type="button"
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    setReplyToMessage({
                      id: m.id,
                      authorName: m.authorName,
                      bodySnippet: m.body.length > 120 ? `${m.body.slice(0, 117)}…` : m.body,
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
                  onClick={() => void handleCopyMessageBody(m)}
                >
                  Copiar texto
                </button>
                <button
                  type="button"
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    setReactionPickerForMessageId((prev) => (prev === m.id ? null : m.id));
                    setActionMenuForMessageId(null);
                    setActionMenuPosition(null);
                  }}
                >
                  Reaccionar…
                </button>
                <button
                  type="button"
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => void openForwardModal(m)}
                >
                  Reenviar…
                </button>
              </>
            );
          })()}
        </div>
      )}

      {forwardOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-[50] flex items-center justify-center bg-black/45 p-4"
          onClick={() => {
            setForwardOpen(false);
            setForwardSource(null);
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
            role="dialog"
            aria-label="Reenviar mensaje"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reenviar mensaje</h3>
            {forwardLoading ? (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Cargando…</p>
            ) : (
              <>
                <p className="mt-2 line-clamp-3 text-xs text-slate-600 dark:text-slate-300">
                  {forwardSource?.body || "(sin texto)"}
                </p>
                <div className="mt-3 flex gap-3 text-xs">
                  <label className="flex cursor-pointer items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      className="h-3.5 w-3.5"
                      checked={forwardMode === "CONVERSATION"}
                      onChange={() => setForwardMode("CONVERSATION")}
                    />
                    Chat existente
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      className="h-3.5 w-3.5"
                      checked={forwardMode === "DIRECT"}
                      onChange={() => setForwardMode("DIRECT")}
                    />
                    Nueva DM
                  </label>
                </div>
                {forwardMode === "CONVERSATION" ? (
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    value={forwardConvId}
                    onChange={(e) => setForwardConvId(e.target.value)}
                  >
                    {forwardConvOptions.filter((c) => c.id !== selectedId).length === 0 ? (
                      <option value="">Ningún otro chat (use pantalla completa)</option>
                    ) : (
                      forwardConvOptions
                        .filter((c) => c.id !== selectedId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))
                    )}
                  </select>
                ) : (
                  <select
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    value={forwardUserId}
                    onChange={(e) => setForwardUserId(e.target.value)}
                  >
                    {forwardDirectory.length === 0 ? (
                      <option value="">Sin contactos</option>
                    ) : (
                      forwardDirectory.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))
                    )}
                  </select>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    onClick={() => {
                      setForwardOpen(false);
                      setForwardSource(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                    disabled={
                      forwardMode === "CONVERSATION"
                        ? !forwardConvId
                        : !forwardUserId
                    }
                    onClick={() => void confirmForwardMessage()}
                  >
                    Enviar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
