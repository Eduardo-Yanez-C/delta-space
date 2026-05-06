import { Type } from "class-transformer";
import { IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class TransportFieldsPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tripNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  guideNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  truckPlate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  trailerPlate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  conductor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  driverRut?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  driverPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  transportCompany?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  logisticsTransportStatus?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pickupOrigin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  deliveryDestination?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  deliveryObservation?: string | null;
}

export class ApplyTransportToGroupDto {
  @IsString()
  @MaxLength(64)
  projectId!: string;

  /** ID de pallet como en inventario/OQC; vacío = grupo «sin pallet». */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  palletId?: string | null;

  /** Si se indica, también se escribe la fila en `transportJson` del snapshot (Registro Transporte). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  snapshotId?: string | null;

  @ValidateNested()
  @Type(() => TransportFieldsPatchDto)
  patch!: TransportFieldsPatchDto;
}
