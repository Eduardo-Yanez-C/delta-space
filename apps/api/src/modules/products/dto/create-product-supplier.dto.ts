export class CreateProductSupplierDto {
  supplierId!: string;
  isPrimary?: boolean;
  isAlternative?: boolean;
  leadTimeDays?: number | null;
  moq?: string | null;
  warranty?: string | null;
  notes?: string | null;
}
