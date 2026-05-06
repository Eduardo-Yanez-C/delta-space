export class UpdateQuoteDto {
  title?: string;
  projectType?: string;
  internalNotes?: string;
  clientNotes?: string;
  currency?: string;
  validUntil?: string;
  paymentTerms?: string;
  deliveryDays?: number;
  commercialStage?: string;
  status?: string;
  leadNumber?: string;
  salespersonId?: string;
  sourceFvStudyId?: string | null;
  technicalBasicsJson?: Record<string, unknown> | null;
}
