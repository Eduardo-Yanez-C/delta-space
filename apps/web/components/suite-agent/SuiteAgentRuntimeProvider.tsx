"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { SuiteAgentChatContext } from "../../lib/suite-agent-chat";
import { SUITE_SOFTWARE_OVERVIEW_FOR_AGENT, SUITE_SOFTWARE_OVERVIEW_VERSION } from "../../lib/suite-software-overview";

export type AgentSurfaceId =
  | "generic"
  | "ventas-panel"
  | "ventas-hub"
  | "cotizaciones"
  | "suite-proyectos-list"
  | "suite-proyectos-nuevo"
  | "suite-proyectos-planning"
  | "suite-proyectos-resumen"
  | "suite-proyectos-ia-tab"
  | "suite-agentes-ia"
  | "suite-organigrama"
  | "suite-logistica"
  | "suite-control-flota"
  | "suite-contabilidad"
  | "suite-administracion"
  | "suite-rrhh"
  | "suite-riesgos"
  | "suite-otro";

export type SuiteAgentAttachment = {
  id: string;
  kind: "gantt_snapshot" | "text" | "csv";
  title: string;
  /** Contenido o resumen (p. ej. CSV/TSV de tareas para el modelo) */
  body: string;
  capturedAt: number;
};

export type SuiteAgentRuntimeState = {
  surfaceId: AgentSurfaceId;
  surfaceTitle: string;
  routePath: string;
  projectId?: string | null;
  projectName?: string | null;
  /** Líneas breves: vista Gantt, nº tareas, etc. */
  summary?: string;
  attachments: SuiteAgentAttachment[];
};

const MAX_ATTACHMENTS = 6;
/** Límite por adjunto enviado al API del agente (reduce prompt_tokens). */
const MAX_BODY_PER_ATTACHMENT = 12_000;

const EMPTY_STATE: SuiteAgentRuntimeState = {
  surfaceId: "generic",
  surfaceTitle: "Aplicación",
  routePath: "",
  projectId: null,
  projectName: null,
  summary: undefined,
  attachments: [],
};

/** Id de proyecto en rutas `/vista-previa-suite/proyectos/:id/...` (no listado ni "nuevo"). */
export function suiteProjectIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/vista-previa-suite\/proyectos\/([^/]+)/);
  if (!m?.[1] || m[1] === "nuevo") return null;
  return m[1];
}

function detectSurface(pathname: string): Pick<SuiteAgentRuntimeState, "surfaceId" | "surfaceTitle"> {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/software-de-cotizaciones/panel-de-ventas") {
    return { surfaceId: "ventas-panel", surfaceTitle: "Panel de ventas" };
  }
  if (p.startsWith("/software-de-cotizaciones")) {
    return { surfaceId: "ventas-hub", surfaceTitle: "Ventas (hub)" };
  }
  if (p.startsWith("/cotizaciones")) {
    return { surfaceId: "cotizaciones", surfaceTitle: "Cotizaciones" };
  }
  if (p.match(/^\/vista-previa-suite\/proyectos\/[^/]+\/planning$/)) {
    return { surfaceId: "suite-proyectos-planning", surfaceTitle: "Planificación del proyecto" };
  }
  if (p.includes("/vista-previa-suite/proyectos/") && p.includes("/modulo/ia-pmo")) {
    return { surfaceId: "suite-proyectos-ia-tab", surfaceTitle: "SAM (proyecto)" };
  }
  if (p.match(/^\/vista-previa-suite\/proyectos\/[^/]+$/) && !p.endsWith("/nuevo")) {
    return { surfaceId: "suite-proyectos-resumen", surfaceTitle: "Resumen de proyecto" };
  }
  if (p === "/vista-previa-suite/proyectos/nuevo") {
    return { surfaceId: "suite-proyectos-nuevo", surfaceTitle: "Nuevo proyecto" };
  }
  if (p === "/vista-previa-suite/proyectos") {
    return { surfaceId: "suite-proyectos-list", surfaceTitle: "Proyectos (suite)" };
  }
  if (p === "/vista-previa-suite/agentes-ia/uso") {
    return { surfaceId: "suite-agentes-ia", surfaceTitle: "Uso SAM" };
  }
  if (p === "/vista-previa-suite/agentes-ia") {
    return { surfaceId: "suite-agentes-ia", surfaceTitle: "Hub SAM" };
  }
  if (p === "/vista-previa-suite/organigrama") {
    return { surfaceId: "suite-organigrama", surfaceTitle: "Organigrama" };
  }
  if (p.startsWith("/vista-previa-suite/logistica")) {
    return { surfaceId: "suite-logistica", surfaceTitle: "Logística" };
  }
  if (p.startsWith("/vista-previa-suite/control-de-flota")) {
    return { surfaceId: "suite-control-flota", surfaceTitle: "Control de flota" };
  }
  if (p.startsWith("/vista-previa-suite/contabilidad")) {
    return { surfaceId: "suite-contabilidad", surfaceTitle: "Contabilidad" };
  }
  if (p.startsWith("/vista-previa-suite/administracion")) {
    return { surfaceId: "suite-administracion", surfaceTitle: "Administración" };
  }
  if (p.startsWith("/vista-previa-suite/rrhh")) {
    return { surfaceId: "suite-rrhh", surfaceTitle: "RRHH" };
  }
  if (p.startsWith("/vista-previa-suite/riesgos")) {
    return { surfaceId: "suite-riesgos", surfaceTitle: "Riesgos" };
  }
  if (p.startsWith("/vista-previa-suite/")) {
    return { surfaceId: "suite-otro", surfaceTitle: "Suite (vista previa)" };
  }
  return { surfaceId: "generic", surfaceTitle: "Aplicación" };
}

export type SuiteAgentRuntimeApi = {
  state: SuiteAgentRuntimeState;
  /** Reemplaza campos; no vacía adjuntos salvo que envíes attachments. */
  mergeRuntime: (patch: Partial<SuiteAgentRuntimeState>) => void;
  clearProjectContext: () => void;
  addAttachment: (att: Omit<SuiteAgentAttachment, "capturedAt"> & { capturedAt?: number }) => void;
  clearAttachments: () => void;
  /** JSON listo para pegar en un LLM (incluye mapa del software). */
  buildExportPayload: () => string;
  /** Objeto para POST /suite-agent/chat (sin metadatos de exportación). */
  buildAgentContextForRequest: () => SuiteAgentChatContext;
};

const Ctx = createContext<SuiteAgentRuntimeApi | null>(null);

export function SuiteAgentRuntimeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<SuiteAgentRuntimeState>({ ...EMPTY_STATE, routePath: pathname });

  useEffect(() => {
    const base = detectSurface(pathname);
    const urlProjectId = suiteProjectIdFromPathname(pathname);
    setState((prev) => ({
      ...EMPTY_STATE,
      routePath: pathname,
      surfaceId: base.surfaceId,
      surfaceTitle: base.surfaceTitle,
      attachments: prev.attachments,
      summary: undefined,
      projectId: urlProjectId,
      projectName: urlProjectId && prev.projectId === urlProjectId ? prev.projectName : null,
    }));
  }, [pathname]);

  const mergeRuntime = useCallback((patch: Partial<SuiteAgentRuntimeState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch, routePath: patch.routePath ?? prev.routePath };
      if (patch.attachments === undefined) {
        next.attachments = prev.attachments;
      }
      return next;
    });
  }, []);

  const clearProjectContext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      projectId: null,
      projectName: null,
      summary: undefined,
    }));
  }, []);

  const addAttachment = useCallback((att: Omit<SuiteAgentAttachment, "capturedAt"> & { capturedAt?: number }) => {
    const body = att.body.slice(0, MAX_BODY_PER_ATTACHMENT);
    const full: SuiteAgentAttachment = {
      ...att,
      body,
      capturedAt: att.capturedAt ?? Date.now(),
    };
    setState((prev) => ({
      ...prev,
      attachments: [full, ...prev.attachments.filter((a) => a.id !== att.id)].slice(0, MAX_ATTACHMENTS),
    }));
  }, []);

  const clearAttachments = useCallback(() => {
    setState((prev) => ({ ...prev, attachments: [] }));
  }, []);

  const buildExportPayload = useCallback(() => {
    return JSON.stringify(
      {
        overviewVersion: SUITE_SOFTWARE_OVERVIEW_VERSION,
        overview: SUITE_SOFTWARE_OVERVIEW_FOR_AGENT,
        runtime: state,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }, [state]);

  const buildAgentContextForRequest = useCallback((): SuiteAgentChatContext => {
    return {
      overviewVersion: SUITE_SOFTWARE_OVERVIEW_VERSION,
      overview: SUITE_SOFTWARE_OVERVIEW_FOR_AGENT,
      runtime: state,
    };
  }, [state]);

  const api = useMemo(
    () => ({
      state,
      mergeRuntime,
      clearProjectContext,
      addAttachment,
      clearAttachments,
      buildExportPayload,
      buildAgentContextForRequest,
    }),
    [
      state,
      mergeRuntime,
      clearProjectContext,
      addAttachment,
      clearAttachments,
      buildExportPayload,
      buildAgentContextForRequest,
    ],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSuiteAgentRuntime(): SuiteAgentRuntimeApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSuiteAgentRuntime debe usarse dentro de SuiteAgentRuntimeProvider");
  return v;
}

/** Para componentes que a veces montan fuera del provider (tests); en app siempre hay provider. */
export function useSuiteAgentRuntimeOptional(): SuiteAgentRuntimeApi | null {
  return useContext(Ctx);
}
