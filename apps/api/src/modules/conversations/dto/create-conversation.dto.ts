import { IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateConversationDto {
  @IsString()
  @IsIn(["DIRECT", "GROUP"])
  type!: "DIRECT" | "GROUP";

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "El título del grupo es obligatorio" })
  title?: string;

  @IsArray()
  @IsString({ each: true })
  memberUserIds!: string[];
}
