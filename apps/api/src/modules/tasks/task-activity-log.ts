export type TaskActivityEntry = {
  id: string;
  t: number;
  actor: string;
  message: string;
  kind: "field_change" | "comment" | "scheduled" | "time_log";
};

const MAX_STORED = 400;
const MAX_APPEND_BATCH = 40;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isValidKind(k: unknown): k is TaskActivityEntry["kind"] {
  return k === "field_change" || k === "comment" || k === "scheduled" || k === "time_log";
}

export function parseStoredActivityLog(raw: string | null | undefined): TaskActivityEntry[] {
  if (raw == null || raw === "") return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: TaskActivityEntry[] = [];
    for (const x of v) {
      if (!isPlainObject(x)) continue;
      const id = typeof x.id === "string" && x.id.trim() ? x.id.trim() : null;
      const t = typeof x.t === "number" && Number.isFinite(x.t) ? x.t : null;
      const actor = typeof x.actor === "string" ? x.actor.slice(0, 200) : "";
      const message = typeof x.message === "string" ? x.message.slice(0, 4000) : "";
      const kind = x.kind;
      if (!id || t == null || !message || !isValidKind(kind)) continue;
      out.push({ id, t, actor, message, kind });
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeActivityLog(entries: TaskActivityEntry[]): string {
  return JSON.stringify(entries.slice(0, MAX_STORED));
}

/** Nuevas entradas primero; evita duplicar por `id`. */
export function mergeActivityAppend(existing: TaskActivityEntry[], append: TaskActivityEntry[]): TaskActivityEntry[] {
  const trimmed = append.slice(0, MAX_APPEND_BATCH).filter((e) => e.id && e.message && isValidKind(e.kind));
  const seen = new Set<string>();
  const out: TaskActivityEntry[] = [];
  for (const e of [...trimmed, ...existing]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
    if (out.length >= MAX_STORED) break;
  }
  return out;
}

export function normalizeAppendInput(raw: unknown): TaskActivityEntry[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: TaskActivityEntry[] = [];
  for (const x of raw) {
    if (!isPlainObject(x)) continue;
    const id = typeof x.id === "string" && x.id.trim() ? x.id.trim().slice(0, 120) : "";
    const t = typeof x.t === "number" && Number.isFinite(x.t) ? x.t : Date.now();
    const actor = typeof x.actor === "string" ? x.actor.slice(0, 200) : "";
    const message = typeof x.message === "string" ? x.message.slice(0, 4000) : "";
    const kind = x.kind;
    if (!id || !message || !isValidKind(kind)) continue;
    out.push({ id, t, actor, message, kind });
  }
  return out.slice(0, MAX_APPEND_BATCH);
}
