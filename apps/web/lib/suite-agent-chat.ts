import { getApiBase, getAuthToken } from "./api";

export type SuiteAgentChatMessage = { role: "user" | "assistant"; content: string };

export type SuiteAgentChatContext = {
  overviewVersion: number;
  overview: string;
  runtime: unknown;
};

export type SuiteAgentChatResponse = {
  reply: string;
  toolTrace: Array<{ name: string; ok: boolean; detail: string }>;
  tasksMutated: boolean;
};

/** Mensaje ampliado cuando falta OPENAI_API_KEY en Nest (503). */
export function formatSuiteAgentConfigError(status: number, serverDetail: string): string {
  const d = serverDetail.trim();
  if (status === 403 && /l[ií]mite|token/i.test(d)) {
    return [
      "El asistente IA no puede continuar: se alcanzó el tope mensual de tokens configurado para su usuario (mes UTC).",
      "",
      "Un administrador puede aumentar o quitar el límite en Usuarios → editar usuario (campo de límite de tokens IA), o en el panel de uso de IA si está disponible.",
      "",
      `Detalle: ${d || "HTTP 403"}`,
    ].join("\n");
  }
  const needsKey =
    status === 503 || d.includes("OPENAI_API_KEY") || d.toLowerCase().includes("openai_api_key");
  if (!needsKey) return d || `Error HTTP ${status}`;

  return [
    "El asistente no puede llamar a OpenAI: el API Nest no tiene OPENAI_API_KEY.",
    "",
    "Pasos:",
    "1) Abra el archivo .env dentro de la carpeta del API (apps/api/.env).",
    "2) Añada: OPENAI_API_KEY=sk-... (clave de https://platform.openai.com/api-keys ).",
    "3) Guarde y reinicie el proceso del API (cierre la terminal de Nest y vuelva a ejecutar start:dev o su script).",
    "",
    "Si usa env.embedded en apps/api y allí aparece OPENAI_API_KEY vacía, puede tapar .env: ponga la clave en env.embedded o quite esa línea del embedded.",
    "",
    `Respuesta del servidor: ${d || `HTTP ${status}`}`,
  ].join("\n");
}

export async function fetchSuiteAgentChat(payload: {
  messages: SuiteAgentChatMessage[];
  context: SuiteAgentChatContext;
}): Promise<SuiteAgentChatResponse> {
  const token = getAuthToken();
  const res = await fetch(`${getApiBase()}/suite-agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      if (typeof j.message === "string") msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.map((x) => String(x)).join(" ");
    } catch {
      /* usar texto bruto */
    }
    throw new Error(formatSuiteAgentConfigError(res.status, msg));
  }
  return JSON.parse(text) as SuiteAgentChatResponse;
}

/** Disparar tras mutar tareas vía el agente para refrescar planificación / Gantt. */
export const SUITE_AGENT_TASKS_MUTATED_EVENT = "suite-agent:tasks-mutated";

/** Abre el panel flotante del asistente IA (desde la pestaña IA del proyecto, etc.). */
export const SUITE_AGENT_OPEN_PANEL_EVENT = "suite-agent:open-panel";

export function dispatchSuiteAgentTasksMutated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUITE_AGENT_TASKS_MUTATED_EVENT));
}

export function dispatchSuiteAgentOpenPanel() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUITE_AGENT_OPEN_PANEL_EVENT));
}
