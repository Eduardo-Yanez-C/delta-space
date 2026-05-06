export const QUOTE_COMMERCIAL_STATUSES = [
  "BORRADOR",
  "LISTA_PARA_ENVIAR",
  "ENVIADA",
  "ACEPTADA",
  "RECHAZADA",
  "ANULADA",
  "CERRADA_SIN_VENTA",
  "EXPIRADA",
  /** Gestionado: oculto en listados por defecto; conserva historial y versiones. */
  "ARCHIVADA",
] as const;

/** Sinónimos de API → estado canónico. */
const QUOTE_STATUS_SYNONYMS: Record<string, (typeof QUOTE_COMMERCIAL_STATUSES)[number]> =
  {
    CANCELADA: "ANULADA",
    CANCELADO: "ANULADA",
  };

/** Cotizaciones que el listado GET /quotes excluye salvo `includeInactive=true`. */
export const QUOTE_STATUSES_HIDDEN_FROM_DEFAULT_LIST: readonly string[] = [
  "ARCHIVADA",
  "ANULADA",
];

export function normalizeQuoteCommercialStatus(input: string): string {
  const raw = (input || "").trim().toUpperCase();
  const normalized = QUOTE_STATUS_SYNONYMS[raw] ?? raw;
  if ((QUOTE_COMMERCIAL_STATUSES as readonly string[]).includes(normalized)) {
    return normalized;
  }
  throw new Error(`Estado comercial inválido: ${input}`);
}

export function isQuoteTerminalArchivedOrCancelled(status: string): boolean {
  return QUOTE_STATUSES_HIDDEN_FROM_DEFAULT_LIST.includes(
    (status || "").trim().toUpperCase(),
  );
}
