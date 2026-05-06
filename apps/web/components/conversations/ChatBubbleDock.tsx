"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ConversationListItemDto,
  type ConversationMessageDto,
  fetchConversationMessages,
  fetchConversationsList,
  postConversationMessage,
  postConversationRead,
} from "../../lib/api";
import { MessageMetadataBlock } from "./MessageMetadataBlock";
import { AutocorrectTextarea } from "../input/AutocorrectTextarea";

const LS_KEY = "chatBubbleDock.v1";
const LIST_PREVIEW_N = 10;
const POLL_LIST_MS = 25_000;
const POLL_MESSAGES_MS = 12_000;
const PAGE_SIZE = 50;
const BUBBLE_SIZE = 56;
const PANEL_W = 360;
const PANEL_H = 480;
const DEFAULT_RIGHT = 24;
const DEFAULT_BOTTOM = 24;

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessageDto[]>([]);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [olderLoadedCount, setOlderLoadedCount] = useState(0);
  const olderLoadedCountRef = useRef(0);
  olderLoadedCountRef.current = olderLoadedCount;

  const bottomRef = useRef<HTMLDivElement>(null);
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
    if (!selectedId || !panelOpen) {
      setMessages([]);
      return;
    }
    void loadThread(selectedId);
  }, [selectedId, panelOpen, loadThread]);

  useEffect(() => {
    if (msgPollRef.current) {
      clearInterval(msgPollRef.current);
      msgPollRef.current = null;
    }
    if (!selectedId || !panelOpen) return;
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
  }, [selectedId, panelOpen, loadList]);

  const totalUnread = list.reduce((acc, c) => acc + (c.unreadCount > 0 ? c.unreadCount : 0), 0);
  const previewList = list.slice(0, LIST_PREVIEW_N);

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
    void loadList();
  };

  const minimizePanel = () => {
    setPanelOpen(false);
    setSelectedId(null);
    setMessages([]);
  };

  const send = async () => {
    if (!selectedId || !input.trim() || sending) return;
    setSending(true);
    setMsgError(null);
    try {
      await postConversationMessage(selectedId, input.trim());
      setInput("");
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
      setMsgError(err instanceof Error ? err.message : "Error al enviar");
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
              aria-label="Chat interno entre usuarios (no es SAM). SAM es el botón ✦ morado arriba."
              title="Conversaciones entre usuarios del sistema. SAM (asistente de DELTA SPACE) es el botón ✦ violeta encima de esta burbuja."
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
                maxHeight: "min(480px, calc(100vh - 24px))",
              }}
              role="dialog"
              aria-label="Conversaciones rápidas"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
                <div
                  className="min-w-0 flex-1 cursor-grab py-1 active:cursor-grabbing"
                  onPointerDown={(e) => onPointerDownDrag(e, "header")}
                  onPointerMove={onPointerMoveDrag}
                  onPointerUp={onPointerUpDrag}
                  onPointerCancel={onPointerUpDrag}
                >
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {selectedId ? "Hilo" : "Conversaciones"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {selectedId && (
                    <button
                      type="button"
                      className="rounded p-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                      onClick={() => {
                        setSelectedId(null);
                        setMessages([]);
                      }}
                    >
                      ← Lista
                    </button>
                  )}
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
                      setSelectedId(null);
                      setMessages([]);
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

              <div className="min-h-0 flex-1 flex flex-col">
                {!selectedId && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                      <Link
                        href="/conversaciones"
                        className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                        onClick={() => setPanelOpen(false)}
                      >
                        Ver todas en pantalla completa →
                      </Link>
                    </div>
                    <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                      {previewList.length === 0 && (
                        <li className="px-2 py-4 text-center text-sm text-slate-500 dark:text-slate-300">
                          No hay conversaciones.{" "}
                          <Link
                            href="/conversaciones"
                            className="text-primary-600 hover:underline dark:text-primary-400"
                            onClick={() => setPanelOpen(false)}
                          >
                            Crear en Conversaciones
                          </Link>
                        </li>
                      )}
                      {previewList.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="flex w-full flex-col rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => setSelectedId(c.id)}
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
                  </div>
                )}

                {selectedId && (
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
                          <div className="flex flex-wrap gap-1 text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {m.authorName}
                            </span>
                            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">
                            {m.body}
                          </p>
                          <MessageMetadataBlock metadata={m.metadata ?? null} compact />
                        </div>
                      ))}
                      <div ref={bottomRef} />
                    </div>
                    <div className="shrink-0 border-t border-slate-200 p-2 dark:border-slate-700">
                      <p className="mb-1.5 px-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                        <Link
                          href="/conversaciones"
                          className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                          onClick={() => setPanelOpen(false)}
                        >
                          Abrir Conversaciones
                        </Link>{" "}
                        para mencionar usuarios o adjuntar cotizaciones.
                      </p>
                      <div className="flex gap-1">
                        <AutocorrectTextarea
                          wrapperClassName="min-w-0 flex-1"
                          className="min-h-[36px] w-full flex-1 resize-none rounded border border-slate-300 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          rows={2}
                          placeholder="Mensaje…"
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
                          className="self-end rounded bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                          disabled={sending || !input.trim()}
                          onClick={() => void send()}
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
