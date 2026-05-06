import { BadRequestException } from "@nestjs/common";

export type TaskCustomFieldRow = {
  id: string;
  type: string;
  label: string;
  value: string;
  required: boolean;
};

export const SUITE_FIELD_CONTEXT_ID = "suite-field-context";

export function normalizeCustomFieldsInput(raw: unknown): TaskCustomFieldRow[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestException("customFields debe ser un arreglo");
  }
  const MAX = 40;
  const seen = new Set<string>();
  const out: TaskCustomFieldRow[] = [];
  for (let i = 0; i < Math.min(raw.length, MAX); i++) {
    const o = raw[i];
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    let id = typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 80) : `fld_${i}_${Date.now()}`;
    if (seen.has(id)) id = `${id}_${i}`;
    seen.add(id);
    const type = typeof r.type === "string" && r.type.trim() ? r.type.trim().slice(0, 48) : "text";
    const label = typeof r.label === "string" && r.label.trim() ? r.label.trim().slice(0, 160) : "Campo";
    const value = r.value == null ? "" : String(r.value).slice(0, 12000);
    const required = Boolean(r.required);
    out.push({ id, type, label, value, required });
  }
  return out;
}

export function assertRequiredCustomFieldsFilled(fields: TaskCustomFieldRow[]): void {
  for (const f of fields) {
    if (f.required && !String(f.value ?? "").trim()) {
      throw new BadRequestException(`Completa el campo obligatorio «${f.label}»`);
    }
  }
}

/** Inserta o actualiza la fila «Comentario» al inicio; `contextNote` sustituye el valor si viene definido (incluye ""). */
export function mergeContextNoteIntoFields(
  fields: TaskCustomFieldRow[] | null | undefined,
  contextNote: string | null | undefined,
): TaskCustomFieldRow[] {
  const list = Array.isArray(fields) ? [...fields] : [];
  const idx = list.findIndex((f) => f.id === SUITE_FIELD_CONTEXT_ID);
  const explicit = contextNote !== null && contextNote !== undefined;
  const value = explicit ? String(contextNote) : idx >= 0 ? list[idx]!.value : "";
  const required = idx >= 0 ? Boolean(list[idx]!.required) : false;
  if (idx >= 0) list.splice(idx, 1);
  list.unshift({
    id: SUITE_FIELD_CONTEXT_ID,
    type: "textarea",
    label: "Comentario",
    value,
    required,
  });
  return list;
}

export function serializeCustomFieldsForDb(fields: TaskCustomFieldRow[]): string {
  return JSON.stringify(fields);
}

/** Lectura desde DB: no lanza (datos legacy o corruptos → []). Acepta string JSON o array ya parseado. */
export function parseStoredCustomFields(raw: unknown): TaskCustomFieldRow[] {
  if (raw == null) return [];
  let data: unknown = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      data = JSON.parse(s) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const out: TaskCustomFieldRow[] = [];
  const MAX = 40;
  for (let i = 0; i < Math.min(data.length, MAX); i++) {
    const o = data[i];
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 80) : `fld_${i}`;
    const type = typeof r.type === "string" && r.type.trim() ? r.type.trim().slice(0, 48) : "text";
    const label = typeof r.label === "string" && r.label.trim() ? r.label.trim().slice(0, 160) : "Campo";
    const value = r.value == null ? "" : String(r.value).slice(0, 12000);
    const required = Boolean(r.required);
    out.push({ id, type, label, value, required });
  }
  return out;
}
