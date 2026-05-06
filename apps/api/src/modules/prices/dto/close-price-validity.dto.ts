import { IsOptional, IsString, MaxLength } from "class-validator";

/** Cierre explícito de una vigencia abierta (`validTo` null). */
export class ClosePriceValidityDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  /** Fin de vigencia (ISO u otro formato parseable por `Date`). Si se omite: fin del día UTC actual. */
  validTo?: string;
}
