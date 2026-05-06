/** Persistencia local (suite cotizaciones) — columnas, filtros, vistas guardadas. */

export const SUITE_PLANNING_COL_WIDTHS_KEY = "pv_suite_planning_colWidths_v1";
export const SUITE_PLANNING_COL_VISIBLE_KEY = "pv_suite_planning_colVisible_v1";
export const SUITE_PLANNING_VIEW_OPTS_KEY = "pv_suite_planning_viewOpts_v1";
export const SUITE_PLANNING_SAVED_VIEWS_KEY = "pv_suite_planning_savedViews_v1";
export const SUITE_GANTT_LIST_COLS_KEY = "pv_suite_planning_ganttListCols_v1";

export type PlanningColumnId =
  | "name"
  | "status"
  | "priority"
  | "assignee"
  | "start"
  | "end"
  | "progress"
  | "checklist"
  | "deps"
  | "context"
  | "subs";

export const DEFAULT_COL_WIDTHS: Record<PlanningColumnId, number> = {
  name: 220,
  status: 112,
  priority: 88,
  assignee: 120,
  start: 92,
  end: 92,
  progress: 76,
  checklist: 64,
  deps: 72,
  context: 140,
  subs: 52,
};

export const COL_WIDTH_MIN: Record<PlanningColumnId, number> = {
  name: 140,
  status: 88,
  priority: 72,
  assignee: 88,
  start: 80,
  end: 80,
  progress: 56,
  checklist: 52,
  deps: 56,
  context: 96,
  subs: 40,
};

export const COL_WIDTH_MAX: Record<PlanningColumnId, number> = {
  name: 480,
  status: 160,
  priority: 120,
  assignee: 220,
  start: 120,
  end: 120,
  progress: 88,
  checklist: 100,
  deps: 140,
  context: 360,
  subs: 72,
};

export const ALL_COLUMN_IDS: PlanningColumnId[] = [
  "name",
  "status",
  "priority",
  "assignee",
  "start",
  "end",
  "progress",
  "checklist",
  "deps",
  "context",
  "subs",
];

export type PlanningViewOpts = {
  rowDensity: "compact" | "comfortable";
  sortBy: "tree" | "name" | "endDate" | "priority";
  groupBy: "status";
  filterOverdue: boolean;
  filterBlocked: boolean;
  filterAssigneeId: string;
};

export const DEFAULT_VIEW_OPTS: PlanningViewOpts = {
  rowDensity: "compact",
  sortBy: "tree",
  groupBy: "status",
  filterOverdue: false,
  filterBlocked: false,
  filterAssigneeId: "",
};

export type SavedPlanningView = {
  id: string;
  name: string;
  createdAt: string;
  colWidths: Record<PlanningColumnId, number>;
  colVisible: Record<PlanningColumnId, boolean>;
  viewOpts: PlanningViewOpts;
  mineOnly: boolean;
  tableStatusFilter: string;
  tablePriorityFilter: string;
  tableRootsOnly: boolean;
  tableCriticalOnly: boolean;
  tableSearch: string;
};

export type GanttListColumnId = "wbs" | "name" | "duration" | "start" | "end" | "pct";

export const ALL_GANTT_LIST_COL_IDS: GanttListColumnId[] = [
  "wbs",
  "name",
  "duration",
  "start",
  "end",
  "pct",
];

export const DEFAULT_GANTT_LIST_VISIBLE: Record<GanttListColumnId, boolean> = {
  wbs: true,
  name: true,
  duration: true,
  start: true,
  end: true,
  pct: true,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadColWidths(): Record<PlanningColumnId, number> {
  if (typeof window === "undefined") return { ...DEFAULT_COL_WIDTHS };
  const parsed = safeParse<Partial<Record<string, number>>>(localStorage.getItem(SUITE_PLANNING_COL_WIDTHS_KEY), {});
  const out = { ...DEFAULT_COL_WIDTHS };
  for (const id of ALL_COLUMN_IDS) {
    const v = parsed[id];
    if (typeof v === "number" && v > 0) out[id] = v;
  }
  return out;
}

export function saveColWidths(w: Record<PlanningColumnId, number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUITE_PLANNING_COL_WIDTHS_KEY, JSON.stringify(w));
}

export function loadColVisible(): Record<PlanningColumnId, boolean> {
  if (typeof window === "undefined") {
    return Object.fromEntries(ALL_COLUMN_IDS.map((k) => [k, true])) as Record<PlanningColumnId, boolean>;
  }
  const parsed = safeParse<Partial<Record<string, boolean>>>(localStorage.getItem(SUITE_PLANNING_COL_VISIBLE_KEY), {});
  const out = {} as Record<PlanningColumnId, boolean>;
  for (const id of ALL_COLUMN_IDS) {
    out[id] = parsed[id] !== false;
  }
  return out;
}

export function saveColVisible(v: Record<PlanningColumnId, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUITE_PLANNING_COL_VISIBLE_KEY, JSON.stringify(v));
}

export function loadViewOpts(): PlanningViewOpts {
  if (typeof window === "undefined") return { ...DEFAULT_VIEW_OPTS };
  return {
    ...DEFAULT_VIEW_OPTS,
    ...safeParse<Partial<PlanningViewOpts>>(localStorage.getItem(SUITE_PLANNING_VIEW_OPTS_KEY), {}),
  };
}

export function saveViewOpts(o: PlanningViewOpts) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUITE_PLANNING_VIEW_OPTS_KEY, JSON.stringify(o));
}

export function loadSavedViews(): SavedPlanningView[] {
  if (typeof window === "undefined") return [];
  return safeParse<SavedPlanningView[]>(localStorage.getItem(SUITE_PLANNING_SAVED_VIEWS_KEY), []);
}

export function saveSavedViews(list: SavedPlanningView[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUITE_PLANNING_SAVED_VIEWS_KEY, JSON.stringify(list));
}

export function loadGanttListCols(): Record<GanttListColumnId, boolean> {
  if (typeof window === "undefined") return { ...DEFAULT_GANTT_LIST_VISIBLE };
  const parsed = safeParse<Partial<Record<GanttListColumnId, boolean>>>(
    localStorage.getItem(SUITE_GANTT_LIST_COLS_KEY),
    {},
  );
  const out = { ...DEFAULT_GANTT_LIST_VISIBLE };
  for (const id of ALL_GANTT_LIST_COL_IDS) {
    if (parsed[id] === false) out[id] = false;
  }
  return out;
}

export function saveGanttListCols(v: Record<GanttListColumnId, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUITE_GANTT_LIST_COLS_KEY, JSON.stringify(v));
}
