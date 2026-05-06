/** Estado de versión de documento (no estado comercial). */
export const STATUS_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  EXPIRADA: "Expirada",
};

/** Estado comercial de la cotización (ciclo de vida de oportunidad). */
export const COMMERCIAL_STATUS_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  LISTA_PARA_ENVIAR: "Lista para enviar",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  ANULADA: "Anulada / cancelada",
  CERRADA_SIN_VENTA: "Cerrada sin venta",
  EXPIRADA: "Expirada",
  ARCHIVADA: "Archivada",
};

export const COMMERCIAL_STATUS_OPTIONS = [
  "BORRADOR",
  "LISTA_PARA_ENVIAR",
  "ENVIADA",
  "ACEPTADA",
  "RECHAZADA",
  "ANULADA",
  "ARCHIVADA",
  "CERRADA_SIN_VENTA",
  "EXPIRADA",
] as const;

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  RESIDENCIAL: "Residencial",
  COMERCIAL: "Comercial",
  INDUSTRIAL: "Industrial",
};

/** Etiquetas para origen del ítem en cotización (señal visual en todos los ítems). */
export const QUOTE_ITEM_ORIGIN_LABEL = {
  FROM_CATALOG: "Desde catálogo",
  MANUAL: "Manual",
} as const;

/** Etiquetas para totalMode del ítem principal (Vista jerárquica). */
export const QUOTE_MAIN_ITEM_TOTAL_MODE_LABEL: Record<string, string> = {
  SUM_LINES: "Suma de líneas",
  MANUAL: "Manual",
};

/** Resumen FV desde estudio para vista previa/PDF. Si existe sourceFvStudyId se usa solo esto; si no, se usa QuoteFvCalculation. Nunca ambos. */
export type FvSummaryFromStudy = {
  plantaKwp: number;
  cantidadPaneles: number;
  generacionAnualKwh: number;
  ahorroAnual: number;
  porcentajeAhorro: number;
  pagoResidualAnual: number;
  currency: string;
  sourceTitle?: string;
};

export { formatDate, formatMoney, formatPercent } from "../../lib/format";
