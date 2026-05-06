export class CreateQuoteDto {
  clientId!: string;
  title!: string;
  projectType!: string;
  quoteKind?: "STANDARD" | "MARGIN";
  technicalBasicsJson?: Record<string, unknown>;
  internalNotes?: string;
  clientNotes?: string;
  currency?: string;
  validUntil?: string;
  paymentTerms?: string;
  deliveryDays?: number;
  commercialStage?: string;
  leadNumber?: string;
  salespersonId?: string;
}
