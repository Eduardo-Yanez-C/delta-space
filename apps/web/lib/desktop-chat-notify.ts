import { conversationsRealtime, type ConversationMessageNewEvent } from "./conversations-realtime";

/** Evita ráfagas molestas si llegan varios mensajes seguidos. */
const THROTTLE_MS = 2800;

/**
 * Silenciar notificaciones (solo UX). Futuro: enlazar con ajustes de UI.
 * `localStorage.setItem('pv_desktop_chat_notify_muted', '1')` — quitar con removeItem o '0'.
 */
const STORAGE_MUTE_KEY = "pv_desktop_chat_notify_muted";

type DesktopBridge = {
  isDesktop?: boolean;
  setChatAttentionFlash?: (enabled: boolean) => Promise<unknown>;
};

function getDesktop(): DesktopBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __DESKTOP__?: DesktopBridge }).__DESKTOP__;
}

function playSoftChatSound(): void {
  try {
    if (typeof window === "undefined") return;
    const Webkit = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const Ctor = window.AudioContext || Webkit;
    if (!Ctor) return;
    const ctx = new Ctor();
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);

    const tone = (freq: number, start: number, end: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(master);
      osc.start(start);
      osc.stop(end);
    };

    tone(523.25, t0, t0 + 0.1);
    tone(659.25, t0 + 0.08, t0 + 0.22);

    void ctx.resume().catch(() => undefined);
    window.setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        /* noop */
      }
    }, 400);
  } catch {
    /* noop */
  }
}

/**
 * Solo Electron (`__DESKTOP__`). Suscripción global a mensajes nuevos; no afecta web en navegador.
 */
export function registerDesktopChatNotify(viewerUserId: string): () => void {
  const desktop = getDesktop();
  if (!desktop?.isDesktop) {
    return () => undefined;
  }

  let lastAlertAt = 0;

  const handler = (event: ConversationMessageNewEvent) => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_MUTE_KEY) === "1") {
        return;
      }
      const authorId = event.message?.authorId;
      if (!authorId || authorId === viewerUserId) return;

      const inForeground =
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        document.hasFocus();
      const openThread = conversationsRealtime.getActiveJoinedConversationId();
      const viewingThisThread =
        openThread != null && openThread !== "" && event.conversationId === openThread;
      if (inForeground && viewingThisThread) return;

      const now = Date.now();
      if (now - lastAlertAt < THROTTLE_MS) return;
      lastAlertAt = now;

      playSoftChatSound();
      void desktop.setChatAttentionFlash?.(true);
    } catch {
      /* noop */
    }
  };

  const clearFlash = () => {
    void getDesktop()?.setChatAttentionFlash?.(false);
  };

  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      clearFlash();
    }
  };

  window.addEventListener("focus", clearFlash);
  document.addEventListener("visibilitychange", onVisibility);

  const unsub = conversationsRealtime.onMessageNew(handler);

  return () => {
    unsub();
    window.removeEventListener("focus", clearFlash);
    document.removeEventListener("visibilitychange", onVisibility);
    clearFlash();
  };
}
