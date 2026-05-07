"use client";

import { useEffect, useState } from "react";
import { SUITE_AGENT_OPEN_PANEL_EVENT } from "../../lib/suite-agent-chat";
import { SuiteAgentPanel } from "./SuiteAgentPanel";

const BUBBLE = 52;

/**
 * Burbuja flotante opcional de SAM. En la app principal, SAM está integrado en {@link ChatBubbleDock}.
 * Mantener solo si se monta explícitamente en un layout.
 */
export function SuiteAgentBubble() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openPanel = () => {
      setOpen(true);
    };
    window.addEventListener(SUITE_AGENT_OPEN_PANEL_EVENT, openPanel);
    return () => window.removeEventListener(SUITE_AGENT_OPEN_PANEL_EVENT, openPanel);
  }, []);

  return (
    <div className="no-print pointer-events-none fixed bottom-24 right-6 z-[40] flex flex-col items-end gap-2">
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {open ? (
          <div className="flex max-h-[min(72vh,580px)] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900">
            <SuiteAgentPanel onClose={() => setOpen(false)} />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Abrir o cerrar SAM (flotante)"
          className="pointer-events-auto flex h-[var(--sz)] w-[var(--sz)] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-600 text-lg shadow-lg ring-2 ring-violet-200/80 hover:brightness-110 dark:ring-violet-400/40"
          style={{ ["--sz" as string]: `${BUBBLE}px` }}
        >
          <span className="sr-only">SAM</span>
          <span aria-hidden>✦</span>
        </button>
      </div>
    </div>
  );
}
