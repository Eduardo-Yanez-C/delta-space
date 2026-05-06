/**
 * Estados de transporte terrestre por proyecto (`Project.logisticsTransportStatusConfig`).
 * Misma forma que tareas; el valor guardado en inventario suele ser el `id` del estado.
 */

import {
  type TaskStatusConfig,
  normalizeStatusConfig,
  sortStatusDefs,
  statusPillFromConfig,
} from "./suite-task-status-config";

export const DEFAULT_LOGISTICS_TRANSPORT_STATUS_CONFIG: TaskStatusConfig = {
  version: 1,
  statuses: [
    { id: "LT_PENDING", label: "Pendiente de retiro", category: "not_started", order: 0 },
    { id: "LT_IN_TRANSIT", label: "En tránsito", category: "active", order: 1 },
    { id: "LT_SITE", label: "En obra / destino", category: "active", order: 2 },
    { id: "LT_DELIVERED", label: "Entregado", category: "done", order: 3 },
  ],
};

export function normalizeLogisticsTransportStatusConfig(raw: unknown): TaskStatusConfig {
  return normalizeStatusConfig(raw, DEFAULT_LOGISTICS_TRANSPORT_STATUS_CONFIG);
}

/** Coincide por id exacto o por etiqueta (legacy texto libre). */
export function resolveLogisticsTransportStatusId(
  raw: string | null | undefined,
  cfg: TaskStatusConfig,
): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (cfg.statuses.some((s) => s.id === t)) return t;
  const byLabel = cfg.statuses.find((s) => s.label.toLowerCase() === t.toLowerCase());
  return byLabel ? byLabel.id : t;
}

export function logisticsTransportStatusBucket(
  raw: string | null | undefined,
  cfg: TaskStatusConfig,
): "__empty__" | "__legacy__" | string {
  if (!raw?.trim()) return "__empty__";
  const t = raw.trim();
  if (cfg.statuses.some((s) => s.id === t)) return t;
  if (cfg.statuses.some((s) => s.label.toLowerCase() === t.toLowerCase())) {
    const d = cfg.statuses.find((s) => s.label.toLowerCase() === t.toLowerCase());
    return d!.id;
  }
  return "__legacy__";
}

export function logisticsTransportStatusLabel(
  raw: string | null | undefined,
  cfg: TaskStatusConfig,
): string {
  if (!raw?.trim()) return "—";
  const t = raw.trim();
  const byId = cfg.statuses.find((s) => s.id === t);
  if (byId) return byId.label;
  const byLabel = cfg.statuses.find((s) => s.label.toLowerCase() === t.toLowerCase());
  if (byLabel) return byLabel.label;
  return t;
}

export function logisticsTransportStatusPill(
  raw: string | null | undefined,
  cfg: TaskStatusConfig,
): { text: string; className: string } {
  if (!raw?.trim()) return { text: "—", className: "suite-status-pill suite-status-pill--fallback" };
  const id = resolveLogisticsTransportStatusId(raw, cfg);
  if (id && cfg.statuses.some((s) => s.id === id)) return statusPillFromConfig(id, cfg);
  return {
    text: raw.trim(),
    className: "suite-status-pill suite-status-pill--fallback",
  };
}

export { sortStatusDefs };
