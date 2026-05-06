import { IsIn, IsString, MaxLength } from "class-validator";

export class ToggleReactionDto {
  @IsString()
  @MaxLength(16)
  @IsIn(["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"])
  emoji!: string;
}
