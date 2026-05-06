export class FilterQuotesDto {
  status?: string;
  clientId?: string;
  ownerId?: string;
  /** Cotizaciones cuyo estudio FV de origen coincide (evitar duplicados al crear desde estudio). */
  sourceFvStudyId?: string;
  search?: string;
  updatedAfter?: string;
  /**
   * `true` incluye cotizaciones en estado ARCHIVADA o ANULADA (cancelada).
   * Por defecto el listado las omite para mantener la bandeja operativa limpia.
   */
  includeInactive?: string | boolean;
}
