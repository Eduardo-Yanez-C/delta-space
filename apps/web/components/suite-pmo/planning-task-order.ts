import type { SuiteTaskRow } from "../../lib/api";

/** Mismo orden WBS que el Gantt: padres antes que hijos, por sortOrder / WBS / nombre. */
export function orderProjectTasksForDisplay(tasks: SuiteTaskRow[]): SuiteTaskRow[] {
  const byParent = new Map<string | null, SuiteTaskRow[]>();
  for (const t of tasks) {
    const p = t.parentTaskId ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(t);
  }
  for (const arr of Array.from(byParent.values())) {
    arr.sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      const w = String(a.wbsCode ?? "").localeCompare(String(b.wbsCode ?? ""));
      if (w !== 0) return w;
      return a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name);
    });
  }
  const out: SuiteTaskRow[] = [];
  function walk(pid: string | null) {
    for (const c of byParent.get(pid) ?? []) {
      out.push(c);
      walk(c.id);
    }
  }
  walk(null);
  return out;
}
