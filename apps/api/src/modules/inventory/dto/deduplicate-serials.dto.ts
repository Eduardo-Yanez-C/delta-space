import { IsIn, IsString, MinLength } from "class-validator";

export class DeduplicateSerialsDto {
  @IsString()
  @MinLength(1)
  projectId!: string;

  @IsString()
  @IsIn(["OLDEST", "NEWEST"])
  keep!: "OLDEST" | "NEWEST";
}
