/** Configuración de estados de tarea por proyecto (persistida en Project.taskStatusConfig). */

export type TaskStatusCategory = "not_started" | "active" | "done";

export type TaskStatusDef = {
  id: string;
  label: string;
  category: TaskStatusCategory;
  order: number;
};

export type TaskStatusConfig = {
  version: number;
  statuses: TaskStatusDef[];
};

export const DEFAULT_TASK_STATUS_CONFIG: TaskStatusConfig = {
  version: 1,
  statuses: [
    { id: "TODO", label: "POR HACER", category: "not_started", order: 0 },
    { id: "IN_PROGRESS", label: "EN CURSO", category: "active", order: 1 },
    { id: "DONE", label: "HECHO", category: "done", order: 2 },
  ],
};

const CAT_ORDER: TaskStatusCategory[] = ["not_started", "active", "done"];

/** Normaliza lista de estados; `fallback` si el JSON viene vacío o inválido. */
export function normalizeStatusConfig(raw: unknown, fallback: TaskStatusConfig): TaskStatusConfig {
  if (!raw || typeof raw !== "object") {
    return { version: 1, statuses: fallback.statuses.map((s) => ({ ...s })) };
  }
  const o = raw as Partial<TaskStatusConfig>;
  if (!Array.isArray(o.statuses) || o.statuses.length === 0) {
    return { version: 1, statuses: fallback.statuses.map((s) => ({ ...s })) };
  }
  const statuses: TaskStatusDef[] = [];
  for (let i = 0; i < o.statuses.length; i++) {
    const s = o.statuses[i] as Partial<TaskStatusDef>;
    const id = typeof s.id === "string" && s.id.trim() ? s.id.trim() : `st_${i}`;
    const label = typeof s.label === "string" && s.label.trim() ? s.label.trim() : id;
    const cat =
      s.category === "not_started" || s.category === "active" || s.category === "done"
        ? s.category
        : "active";
    const order = typeof s.order === "number" && Number.isFinite(s.order) ? s.order : i;
    statuses.push({ id, label, category: cat, order });
  }
  return { version: 1, statuses };
}

export function normalizeTaskStatusConfig(raw: unknown): TaskStatusConfig {
  return normalizeStatusConfig(raw, DEFAULT_TASK_STATUS_CONFIG);
}

export function sortStatusDefs(list: TaskStatusDef[]): TaskStatusDef[] {
  return [...list].sort((a, b) => {
    const ca = CAT_ORDER.indexOf(a.category);
    const cb = CAT_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.order - b.order || a.label.localeCompare(b.label, "es");
  });
}

export function isTerminalDoneStatus(statusId: string, cfg: TaskStatusConfig): boolean {
  const s = cfg.statuses.find((x) => x.id === statusId);
  if (s) return s.category === "done";
  return statusId.toUpperCase() === "DONE";
}

/** Clases en `globals.css` (@layer components) — no depender del scan de Tailwind en `lib/`. */
export function statusPillFromConfig(statusId: string, cfg: TaskStatusConfig): { text: string; className: string } {
  const s = cfg.statuses.find((x) => x.id === statusId);
  if (s) {
    const variant =
      s.category === "done"
        ? "suite-status-pill--done"
        : s.category === "active"
          ? "suite-status-pill--active"
          : "suite-status-pill--todo";
    return { text: s.label.toUpperCase(), className: `suite-status-pill ${variant}` };
  }
  return {
    text: statusId,
    className: "suite-status-pill suite-status-pill--fallback",
  };
}
