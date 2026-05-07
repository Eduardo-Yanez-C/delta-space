"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAuthToken } from "../../lib/api";
import {
  dispatchSuiteAgentTasksMutated,
  fetchSuiteAgentChat,
  type SuiteAgentChatMessage,
} from "../../lib/suite-agent-chat";
import { getSuiteAgentWeeklyTip } from "../../lib/suite-agent-weekly-tip";
import { useSuiteAgentRuntime } from "./SuiteAgentRuntimeProvider";

type SuiteAgentPanelProps = {
  /** Cuando está dentro del dock unificado (sin botón Cerrar propio). */
  embedded?: boolean;
  className?: string;
  /** Solo en modo ventana flotante. */
  onClose?: () => void;
};

/** Extrae números del resumen que envía el panel de ventas (texto amigable para el agente). */
function parseVentasPanelStats(summary: string | undefined): {
  quotesTotal: number | null;
  studiesTotal: number | null;
  latestQuotes: number | null;
  latestStudies: number | null;
} {
  if (!summary?.trim()) {
    return { quotesTotal: null, studiesTotal: null, latestQuotes: null, latestStudies: null };
  }
  const q = summary.match(/cotizaciones\s+(\d+)/i);
  const s = summary.match(/estudios\s+FV\s+(\d+)/i);
  const lq = summary.match(/Últimas\s+cotizaciones[^:]*:\s*(\d+)/i);
  const ls = summary.match(/Últimos\s+estudios\s+FV:\s*(\d+)/i);
  return {
    quotesTotal: q ? Number(q[1]) : null,
    studiesTotal: s ? Number(s[1]) : null,
    latestQuotes: lq ? Number(lq[1]) : null,
    latestStudies: ls ? Number(ls[1]) : null,
  };
}

/**
 * Panel de SAM (solo chat). El contexto técnico sigue enviándose al modelo por detrás; no se muestra ruta ni JSON al usuario.
 */
export function SuiteAgentPanel({ embedded = false, className = "", onClose }: SuiteAgentPanelProps) {
  const pathname = usePathname();
  const { state, buildAgentContextForRequest, clearAttachments } = useSuiteAgentRuntime();
  const [messages, setMessages] = useState<SuiteAgentChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const weeklyTip = getSuiteAgentWeeklyTip();
  const ventasStats =
    state.surfaceId === "ventas-panel" ? parseVentasPanelStats(state.summary) : null;
  const showVentasStrip =
    ventasStats &&
    (ventasStats.quotesTotal != null ||
      ventasStats.studiesTotal != null ||
      ventasStats.latestQuotes != null ||
      ventasStats.latestStudies != null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    setChatError(null);
  }, [pathname]);

  const sendChat = useCallback(async () => {
    const text = draft.trim();
    if (!text || loading) return;
    if (!getAuthToken()) {
      setChatError("Debe iniciar sesión para usar el chat.");
      return;
    }
    setChatError(null);
    setLoading(true);
    const prev = messages;
    const history = [...prev, { role: "user" as const, content: text }].slice(-14);
    setMessages(history);
    setDraft("");
    try {
      const context = buildAgentContextForRequest();
      const res = await fetchSuiteAgentChat({ messages: history, context });
      setMessages([...history, { role: "assistant", content: res.reply }]);
      if (res.tasksMutated) dispatchSuiteAgentTasksMutated();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Error al contactar a SAM.");
      setMessages(prev);
      setDraft(text);
    } finally {
      setLoading(false);
    }
  }, [draft, loading, messages, buildAgentContextForRequest]);

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`.trim()}>
      {!embedded ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">SAM</p>
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{state.surfaceTitle}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cerrar
            </button>
          ) : null}
        </div>
      ) : (
        <div className="shrink-0 border-b border-slate-200 px-3 py-1.5 dark:border-slate-700">
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{state.surfaceTitle}</p>
        </div>
      )}

      {showVentasStrip ? (
        <div className="shrink-0 border-b border-violet-100 bg-gradient-to-r from-violet-50/95 to-white px-3 py-2.5 dark:border-violet-900/40 dark:from-violet-950/50 dark:to-slate-900/80">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Resumen de su panel
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ventasStats!.quotesTotal != null ? (
              <div className="rounded-lg border border-violet-200/80 bg-white/90 px-2 py-1.5 text-center shadow-sm dark:border-violet-800 dark:bg-slate-900/90">
                <p className="text-lg font-bold tabular-nums text-violet-800 dark:text-violet-200">
                  {ventasStats!.quotesTotal}
                </p>
                <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Cotizaciones</p>
              </div>
            ) : null}
            {ventasStats!.studiesTotal != null ? (
              <div className="rounded-lg border border-violet-200/80 bg-white/90 px-2 py-1.5 text-center shadow-sm dark:border-violet-800 dark:bg-slate-900/90">
                <p className="text-lg font-bold tabular-nums text-violet-800 dark:text-violet-200">
                  {ventasStats!.studiesTotal}
                </p>
                <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Estudios FV</p>
              </div>
            ) : null}
            {ventasStats!.latestQuotes != null ? (
              <div className="rounded-lg border border-slate-200/90 bg-white/90 px-2 py-1.5 text-center shadow-sm dark:border-slate-600 dark:bg-slate-900/90">
                <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {ventasStats!.latestQuotes}
                </p>
                <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Últimas en panel</p>
              </div>
            ) : null}
            {ventasStats!.latestStudies != null ? (
              <div className="rounded-lg border border-slate-200/90 bg-white/90 px-2 py-1.5 text-center shadow-sm dark:border-slate-600 dark:bg-slate-900/90">
                <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {ventasStats!.latestStudies}
                </p>
                <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Estudios recientes</p>
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">Consejo de la semana:</span>{" "}
            {weeklyTip.text}
          </p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm leading-relaxed"
        >
          {messages.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escriba abajo. Puede preguntar por proyectos o tareas según la pantalla en la que esté; SAM usa el
              contexto de la pantalla automáticamente (sin mostrar datos técnicos aquí).
            </p>
          ) : null}
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={`rounded-xl px-3 py-2 ${
                m.role === "user"
                  ? "ml-4 bg-violet-100 text-slate-900 dark:bg-violet-950/80 dark:text-violet-50"
                  : "mr-2 border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
              }`}
            >
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                {m.role === "user" ? "Usted" : "SAM"}
              </p>
              <p className="whitespace-pre-wrap text-[13px]">{m.content}</p>
            </div>
          ))}
          {loading ? <p className="text-xs italic text-slate-500 dark:text-slate-400">Pensando…</p> : null}
        </div>
        {state.attachments.length > 0 ? (
          <div className="shrink-0 border-t border-amber-200/80 bg-amber-50/50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
              Hay {state.attachments.length} adjunto(s) para SAM (cronograma u otros).{" "}
              <button
                type="button"
                onClick={() => clearAttachments()}
                className="font-semibold text-amber-800 underline hover:no-underline dark:text-amber-100"
              >
                Quitar adjuntos
              </button>
            </p>
          </div>
        ) : null}
        {chatError ? (
          <p className="shrink-0 max-h-32 overflow-y-auto border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-snug whitespace-pre-wrap text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
            {chatError}
          </p>
        ) : null}
        <div className="shrink-0 border-t border-slate-200 p-2 dark:border-slate-700">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendChat();
              }
            }}
            rows={2}
            placeholder="Mensaje a SAM… (Enter envía)"
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            disabled={loading}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading || !draft.trim()}
              onClick={() => void sendChat()}
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Enviar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setMessages([]);
                setChatError(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Nuevo chat
            </button>
            <Link
              href="/vista-previa-suite/agentes-ia"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Hub SAM
            </Link>
            <Link
              href="/vista-previa-suite/agentes-ia/uso"
              className="rounded-lg border border-violet-200 px-2.5 py-1.5 text-[11px] font-medium text-violet-800 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-950/40"
            >
              Uso SAM
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
