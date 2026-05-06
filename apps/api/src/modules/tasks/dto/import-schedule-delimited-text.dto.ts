import { IsString, MaxLength } from "class-validator";

export class ImportScheduleDelimitedTextDto {
  @IsString()
  @MaxLength(600_000)
  text!: string;
}
