import type { Layout } from "react-grid-layout";

export const HOME_DASHBOARD_SCHEMA_VERSION = 1 as const;
export const HOME_DASHBOARD_STORAGE_PREFIX = "pv_home_dashboard_v1_";

export type HomeWidgetType =
  | "welcome-header"
  | "external-indicators"
  | "executive-summary"
  | "weekly-message"
  | "radar-commercial"
  | "recent-changes"
  | "follow-up-suggested"
  | "kpis-strip"
  | "kpi-conversion"
  | "kpi-ticket"
  | "kpi-total-amount"
  | "charts-trends"
  | "mini-quotes-month-chart"
  | "mini-studies-month-chart"
  | "mini-conversion-donut"
  | "mini-ops-funnel-chart"
  | "quick-tables";

export type HomeDashboardWidgetInstance = {
  i: string;
  type: HomeWidgetType;
};

export type HomeDashboardPersistedV1 = {
  v: typeof HOME_DASHBOARD_SCHEMA_VERSION;
  widgets: HomeDashboardWidgetInstance[];
  layout: Layout[];
};

export type WidgetCatalogEntry = {
  type: HomeWidgetType;
  label: string;
  description: string;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
  /** Si false (por defecto), solo puede existir una instancia en el tablero. */
  allowMultiple: boolean;
};

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    type: "welcome-header",
    label: "Cabecera Inicio",
    description: "Título y descripción de la página (bloque superior)",
    defaultW: 12,
    defaultH: 2,
    minW: 4,
    minH: 2,
    allowMultiple: false,
  },
  {
    type: "external-indicators",
    label: "Indicadores externos",
    description: "UF, dólar e IPC",
    defaultW: 5,
    defaultH: 2,
    minW: 3,
    minH: 2,
    allowMultiple: false,
  },
  {
    type: "executive-summary",
    label: "Resumen ejecutivo operativo",
    description: "Métricas clave y estado actual",
    defaultW: 8,
    defaultH: 12,
    minW: 4,
    minH: 8,
    allowMultiple: false,
  },
  {
    type: "weekly-message",
    label: "Mensaje de la semana",
    description: "Mensaje rotativo semanal",
    defaultW: 4,
    defaultH: 5,
    minW: 3,
    minH: 4,
    allowMultiple: false,
  },
  {
    type: "radar-commercial",
    label: "Radar comercial",
    description: "Montos, conversión y embudo",
    defaultW: 4,
    defaultH: 10,
    minW: 3,
    minH: 6,
    allowMultiple: false,
  },
  {
    type: "recent-changes",
    label: "Cambios recientes",
    description: "Últimas cotizaciones y estudios",
    defaultW: 4,
    defaultH: 6,
    minW: 3,
    minH: 4,
    allowMultiple: true,
  },
  {
    type: "follow-up-suggested",
    label: "Seguimiento sugerido",
    description: "Recomendaciones operativas",
    defaultW: 4,
    defaultH: 6,
    minW: 3,
    minH: 4,
    allowMultiple: true,
  },
  {
    type: "kpis-strip",
    label: "KPIs principales",
    description: "Franja completa de indicadores",
    defaultW: 12,
    defaultH: 5,
    minW: 6,
    minH: 3,
    allowMultiple: false,
  },
  {
    type: "kpi-conversion",
    label: "Conversión estudio → cotización",
    description: "Porcentaje y ratio",
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
    allowMultiple: true,
  },
  {
    type: "kpi-ticket",
    label: "Ticket promedio",
    description: "Valor promedio por cotización",
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
    allowMultiple: true,
  },
  {
    type: "kpi-total-amount",
    label: "Monto total cotizado",
    description: "Suma de cotizaciones",
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
    allowMultiple: true,
  },
  {
    type: "charts-trends",
    label: "Tendencias y distribución",
    description: "Gráficos del tablero (3 columnas)",
    defaultW: 12,
    defaultH: 10,
    minW: 6,
    minH: 6,
    allowMultiple: false,
  },
  {
    type: "mini-quotes-month-chart",
    label: "Gráfico · Cotizaciones por mes",
    description: "Barras mensuales (últimos 12 meses)",
    defaultW: 6,
    defaultH: 7,
    minW: 4,
    minH: 5,
    allowMultiple: false,
  },
  {
    type: "mini-studies-month-chart",
    label: "Gráfico · Estudios FV por mes",
    description: "Barras mensuales de estudios creados",
    defaultW: 6,
    defaultH: 7,
    minW: 4,
    minH: 5,
    allowMultiple: false,
  },
  {
    type: "mini-conversion-donut",
    label: "Gráfico · Conversión a cotización",
    description: "Donut estudio → cotización",
    defaultW: 4,
    defaultH: 6,
    minW: 3,
    minH: 4,
    allowMultiple: false,
  },
  {
    type: "mini-ops-funnel-chart",
    label: "Gráfico · Embudo y estados",
    description: "Origen de cotizaciones y estudios por estado",
    defaultW: 8,
    defaultH: 6,
    minW: 4,
    minH: 4,
    allowMultiple: false,
  },
  {
    type: "quick-tables",
    label: "Seguimiento rápido",
    description: "Tablas de cotizaciones y estudios",
    defaultW: 12,
    defaultH: 8,
    minW: 6,
    minH: 5,
    allowMultiple: false,
  },
];

const CATALOG_MAP = Object.fromEntries(WIDGET_CATALOG.map((e) => [e.type, e])) as Record<
  HomeWidgetType,
  WidgetCatalogEntry
>;

const validTypes = new Set(WIDGET_CATALOG.map((e) => e.type));

export const DEFAULT_HOME_DASHBOARD: HomeDashboardPersistedV1 = {
  v: HOME_DASHBOARD_SCHEMA_VERSION,
  widgets: [
    { i: "w-external", type: "external-indicators" },
    { i: "w-executive", type: "executive-summary" },
    { i: "w-weekly", type: "weekly-message" },
    { i: "w-radar", type: "radar-commercial" },
    { i: "w-kpis", type: "kpis-strip" },
    { i: "w-mini-q", type: "mini-quotes-month-chart" },
    { i: "w-mini-s", type: "mini-studies-month-chart" },
    { i: "w-mini-c", type: "mini-conversion-donut" },
    { i: "w-mini-f", type: "mini-ops-funnel-chart" },
    { i: "w-tables", type: "quick-tables" },
  ],
  layout: [
    { i: "w-external", x: 0, y: 0, w: 5, h: 2, minW: 3, minH: 2 },
    { i: "w-executive", x: 0, y: 2, w: 8, h: 12, minW: 4, minH: 8 },
    { i: "w-weekly", x: 8, y: 2, w: 4, h: 5, minW: 3, minH: 4 },
    { i: "w-radar", x: 8, y: 7, w: 4, h: 10, minW: 3, minH: 6 },
    { i: "w-kpis", x: 0, y: 14, w: 12, h: 5, minW: 6, minH: 3 },
    { i: "w-mini-q", x: 0, y: 19, w: 6, h: 7, minW: 4, minH: 5 },
    { i: "w-mini-s", x: 6, y: 19, w: 6, h: 7, minW: 4, minH: 5 },
    { i: "w-mini-c", x: 0, y: 26, w: 4, h: 6, minW: 3, minH: 4 },
    { i: "w-mini-f", x: 4, y: 26, w: 8, h: 6, minW: 4, minH: 4 },
    { i: "w-tables", x: 0, y: 32, w: 12, h: 8, minW: 6, minH: 5 },
  ],
};

function catalogFor(type: HomeWidgetType): WidgetCatalogEntry {
  return CATALOG_MAP[type];
}

export function newWidgetInstance(type: HomeWidgetType): { widget: HomeDashboardWidgetInstance; layout: Layout } {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? `w-${crypto.randomUUID()}`
      : `w-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const c = catalogFor(type);
  return {
    widget: { i: id, type },
    layout: {
      i: id,
      x: 0,
      y: 999,
      w: c.defaultW,
      h: c.defaultH,
      minW: c.minW,
      minH: c.minH,
    },
  };
}

function isLayout(x: unknown): x is Layout {
  if (!x || typeof x !== "object") return false;
  const o = x as Layout;
  return (
    typeof o.i === "string" &&
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.w === "number" &&
    typeof o.h === "number"
  );
}

function isWidgetInstance(x: unknown): x is HomeDashboardWidgetInstance {
  if (!x || typeof x !== "object") return false;
  const o = x as HomeDashboardWidgetInstance;
  return typeof o.i === "string" && typeof o.type === "string" && validTypes.has(o.type as HomeWidgetType);
}

export function countWidgetsByType(widgets: HomeDashboardWidgetInstance[], type: HomeWidgetType): number {
  return widgets.filter((w) => w.type === type).length;
}

export function canAddAnotherWidget(
  widgets: HomeDashboardWidgetInstance[],
  type: HomeWidgetType,
): boolean {
  const entry = CATALOG_MAP[type];
  if (!entry) return false;
  if (entry.allowMultiple) return true;
  return countWidgetsByType(widgets, type) === 0;
}

/** Alinea layout y widgets; rellena layout faltante con defaults del catálogo. */
export function reconcileDashboardState(
  widgets: HomeDashboardWidgetInstance[],
  layout: Layout[],
): { widgets: HomeDashboardWidgetInstance[]; layout: Layout[] } {
  const cleanWidgets = widgets.filter((w) => validTypes.has(w.type));
  const layoutById = new Map(layout.filter(isLayout).map((l) => [l.i, l]));
  const nextLayout: Layout[] = [];
  for (const w of cleanWidgets) {
    const existing = layoutById.get(w.i);
    const c = catalogFor(w.type);
    if (existing) {
      nextLayout.push({
        ...existing,
        minW: c.minW,
        minH: c.minH,
        w: Math.max(c.minW, existing.w),
        h: Math.max(c.minH, existing.h),
      });
    } else {
      nextLayout.push({
        i: w.i,
        x: 0,
        y: 999,
        w: c.defaultW,
        h: c.defaultH,
        minW: c.minW,
        minH: c.minH,
      });
    }
  }
  return { widgets: cleanWidgets, layout: nextLayout };
}

export function parsePersistedHomeDashboard(raw: string | null): HomeDashboardPersistedV1 | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return null;
    const o = j as Partial<HomeDashboardPersistedV1>;
    if (o.v !== HOME_DASHBOARD_SCHEMA_VERSION || !Array.isArray(o.widgets) || !Array.isArray(o.layout)) {
      return null;
    }
    const widgets = o.widgets.filter(isWidgetInstance);
    const layout = o.layout.filter(isLayout);
    const rec = reconcileDashboardState(widgets, layout);
    return { v: HOME_DASHBOARD_SCHEMA_VERSION, widgets: rec.widgets, layout: rec.layout };
  } catch {
    return null;
  }
}

export function storageKeyForUser(userId: string | undefined): string {
  return `${HOME_DASHBOARD_STORAGE_PREFIX}${userId ?? "anon"}`;
}
