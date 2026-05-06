import { Transform } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MinLength } from "class-validator";

/**
 * Query del panel administrador comercial V1.
 * `userIds`: opcional; ids de usuario (cuid en Prisma), repetidos en query (?userIds=a&userIds=b) o separados por coma.
 */
export class CommercialPerformanceQueryDto {
    @IsDateString()
    from!: string;

    @IsDateString()
    to!: string;

    @IsOptional()
    @Transform(({ value }) => {
        if (value == null || value === "") return undefined;
        const raw = Array.isArray(value) ? value : String(value).split(",");
        return raw.map((s: string) => s.trim()).filter(Boolean);
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    @MinLength(8, { each: true })
    userIds?: string[];
}
