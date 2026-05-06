"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAuthToken } from "../../lib/api";
import {
  dispatchSuiteAgentTasksMutated,
  fetchSuiteAgentChat,
  SUITE_AGENT_OPEN_PANEL_EVENT,
  type SuiteAgentChatMessage,
} from "../../lib/suite-agent-chat";
import { useSuiteAgentRuntime } from "./SuiteAgentRuntimeProvider";

const BUBBLE = 52;

type TabId = "chat" | "contexto";

export function SuiteAgentBubble() {
  const pathname = usePathname();
  const { state, buildExportPayload, buildAgentContextForRequest, clearAttachments } = useSuiteAgentRuntime();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("chat");
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<SuiteAgentChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open, loading]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    setChatError(null);
  }, [pathname]);

  useEffect(() => {
    const open = () => {
      setOpen(true);
      setTab("chat");
    };
    window.addEventListener(SUITE_AGENT_OPEN_PANEL_EVENT, open);
    return () => window.removeEventListener(SUITE_AGENT_OPEN_PANEL_EVENT, open);
  }, []);

  const onCopy = useCallback(async () => {
    const text = buildExportPayload();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [buildExportPayload]);

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
    <div className="no-print pointer-events-none fixed bottom-24 right-6 z-[40] flex flex-col items-end gap-1">
      <p className="pointer-events-none max-w-[10rem] rounded-md bg-slate-900/85 px-2 py-1 text-center text-[10px] font-semibold leading-tight text-white shadow-md dark:bg-white/90 dark:text-slate-900">
        SAM
        <span className="mt-0.5 block font-normal opacity-90">(no es el chat interno)</span>
      </p>
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {open ? (
          <div
            className="flex max-h-[min(72vh,580px)] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  SAM
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{state.surfaceTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>

            <div className="flex shrink-0 gap-1 border-b border-slate-200 px-2 py-1.5 dark:border-slate-700">
              {(
                [
                  ["chat", "Chat"],
                  ["contexto", "Contexto"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    tab === id
                      ? "bg-violet-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "chat" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div
                  ref={scrollRef}
                  className="min-h-[220px] flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm leading-relaxed"
                >
                  {messages.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Escriba abajo. Desde cualquier pantalla puede preguntar por proyectos: el API expone{" "}
                      <strong className="text-slate-600 dark:text-slate-300">buscar proyectos</strong> y{" "}
                      <strong className="text-slate-600 dark:text-slate-300">listar tareas por id de proyecto</strong>.
                      Si está en planificación, el proyecto activo se usa solo. Crear/editar tareas según su rol. Requiere{" "}
                      <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">OPENAI_API_KEY</code> en el API.
                    </p>
                  ) : null}
                  {messages.map((m, i) => (
                    <div
                      key={`${i}-${m.role}`}
                      className={`rounded-xl px-3 py-2 ${
                        m.role === "user"
                          ? "ml-6 bg-violet-100 text-slate-900 dark:bg-violet-950/80 dark:text-violet-50"
                          : "mr-4 border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100"
                      }`}
                    >
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                        {m.role === "user" ? "Usted" : "Asistente"}
                      </p>
                      <p className="whitespace-pre-wrap text-[13px]">{m.content}</p>
                    </div>
                  ))}
                  {loading ? (
                    <p className="text-xs italic text-slate-500 dark:text-slate-400">Pensando…</p>
                  ) : null}
                </div>
                {chatError ? (
                  <p className="shrink-0 max-h-48 overflow-y-auto border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-snug text-rose-800 whitespace-pre-wrap dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
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
                    placeholder="Mensaje… (Enter envía, Mayús+Enter salto)"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    disabled={loading}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
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
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto px-3 py-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <p>
                  <span className="font-medium text-slate-900 dark:text-slate-100">Ruta:</span>{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                    {state.routePath || "—"}
                  </code>
                </p>
                {(state.projectId || state.projectName) && (
                  <p>
                    <span className="font-medium text-slate-900 dark:text-slate-100">Proyecto:</span>{" "}
                    {state.projectName ?? "—"}{" "}
                    {state.projectId ? (
                      <span className="font-mono text-[10px] text-slate-500">({state.projectId.slice(0, 12)}…)</span>
                    ) : null}
                  </p>
                )}
                {state.summary ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/60">
                    <p className="mb-1 font-medium text-slate-800 dark:text-slate-200">Resumen en pantalla</p>
                    <p className="whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-400">{state.summary}</p>
                  </div>
                ) : (
                  <p className="text-slate-500 dark:text-slate-500">Sin resumen extra en esta pantalla.</p>
                )}
                {state.attachments.length > 0 ? (
                  <div>
                    <p className="mb-1 font-medium text-slate-800 dark:text-slate-200">Adjuntos ({state.attachments.length})</p>
                    <ul className="space-y-1.5">
                      {state.attachments.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/80"
                        >
                          <span className="font-medium text-slate-900 dark:text-slate-100">{a.title}</span>
                          <span className="ml-2 text-[10px] uppercase text-slate-400">{a.kind}</span>
                          <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-slate-600 dark:text-slate-400">
                            {a.body.length > 800 ? `${a.body.slice(0, 800)}…` : a.body}
                          </pre>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => clearAttachments()}
                      className="mt-1 text-[11px] font-medium text-rose-600 hover:underline dark:text-rose-400"
                    >
                      Quitar adjuntos
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => void onCopy()}
                    className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                  >
                    {copied ? "Copiado" : "Copiar contexto JSON"}
                  </button>
                  <Link
                    href="/vista-previa-suite/agentes-ia"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Hub SAM
                  </Link>
                  <Link
                    href="/vista-previa-suite/agentes-ia/uso"
                    className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-medium text-violet-800 hover:bg-violet-50 dark:border-violet-600 dark:text-violet-200 dark:hover:bg-violet-950/40"
                  >
                    Uso SAM
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="SAM — asistente de DELTA SPACE (OpenAI + contexto de pantalla). El icono de conversación más abajo en la esquina es el chat interno entre usuarios."
          aria-expanded={open}
          aria-label="Abrir o cerrar SAM"
          className="pointer-events-auto flex h-[var(--sz)] w-[var(--sz)] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-600 text-lg shadow-lg ring-2 ring-violet-200/80 hover:brightness-110 dark:ring-violet-400/40"
          style={{ ["--sz" as string]: `${BUBBLE}px` }}
        >
          <span className="sr-only">Abrir o cerrar SAM</span>
          <span aria-hidden>✦</span>
        </button>
      </div>
    </div>
  );
}
