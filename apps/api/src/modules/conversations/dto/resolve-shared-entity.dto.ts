import { IsIn, IsOptional, IsString } from "class-validator";

export class ResolveSharedEntityDto {
  @IsString()
  @IsIn(["REJECT", "ACCEPT_CREATE_NEW", "ACCEPT_USE_EXISTING", "ACCEPT_LINK_EXISTING"])
  decision!:
    | "REJECT"
    | "ACCEPT_CREATE_NEW"
    | "ACCEPT_USE_EXISTING"
    | "ACCEPT_LINK_EXISTING";

  @IsOptional()
  @IsString()
  existingEntityId?: string;
}
