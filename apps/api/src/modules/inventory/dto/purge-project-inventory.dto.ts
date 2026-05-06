import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

/** Solo filas `InventoryItem`; nunca borra `Product` del catálogo comercial. */
export class PurgeProjectInventoryDto {
  @IsString()
  @MinLength(1)
  projectId!: string;

  /** Código interno conocido solo por operadores; validado solo en servidor (no mostrar en UI). */
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  securityPin!: string;

  @IsString()
  @IsIn(["OQC_PANELS_ONLY", "ALL_PROJECT_DESTINATION"])
  scope!: "OQC_PANELS_ONLY" | "ALL_PROJECT_DESTINATION";
}
