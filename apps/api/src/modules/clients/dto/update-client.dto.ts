/** Paridad con dist: sin class-validator en el DTO compilado. */
export class UpdateClientDto {
  type?: string;
  name?: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}
