import { BadRequestException } from "@nestjs/common";

const TECHNICAL_BASICS_MAX_CHARS = 32000;

export function serializeTechnicalBasicsJson(value: unknown) {
  const s = JSON.stringify(value);
  if (s.length > TECHNICAL_BASICS_MAX_CHARS) {
    throw new BadRequestException("technicalBasicsJson excede el tamaño máximo permitido");
  }
  return s;
}

export function parseTechnicalBasicsJson(stored: string | null | undefined) {
  if (stored == null || stored.trim() === "") return null;
  try {
    const parsed = JSON.parse(stored);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function mapQuoteResponse<T extends { technicalBasicsJson?: string | null }>(q: T) {
  const { technicalBasicsJson: raw, ...rest } = q;
  return {
    ...rest,
    technicalBasicsJson: parseTechnicalBasicsJson(raw),
  };
}
