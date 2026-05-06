export class UpdateSupplierDto {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  giro?: string | null;
  commercialAddress?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  defaultCurrency?: string | null;
  supplyOrigin?: string;
  actorType?: string;
  paymentTerms?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
  active?: boolean;
}
