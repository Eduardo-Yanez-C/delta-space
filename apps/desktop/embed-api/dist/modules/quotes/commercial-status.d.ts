export declare const QUOTE_COMMERCIAL_STATUSES: readonly ["BORRADOR", "LISTA_PARA_ENVIAR", "ENVIADA", "ACEPTADA", "RECHAZADA", "ANULADA", "CERRADA_SIN_VENTA", "EXPIRADA"];
export type QuoteCommercialStatus = (typeof QUOTE_COMMERCIAL_STATUSES)[number];
export declare function normalizeQuoteCommercialStatus(input: string): QuoteCommercialStatus;
