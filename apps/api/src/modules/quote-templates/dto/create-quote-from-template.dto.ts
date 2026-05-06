export class CreateQuoteFromTemplateDto {
  clientId!: string;
  currency?: string;
  title?: string;
  /** Vincula la cotización al estudio (mismo cliente). */
  fvStudyId?: string;
}
