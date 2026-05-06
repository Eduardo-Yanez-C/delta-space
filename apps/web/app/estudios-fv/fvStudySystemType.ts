import type { MarginSystemType } from "../../lib/margin-technical-basics";

/**
 * Normaliza valores persistidos o legacy del estudio FV al enum usado en formulario y MARGIN.
 */
export function normalizeFvStudySystemType(raw: string | null | undefined): MarginSystemType {
  if (raw == null || String(raw).trim() === "") return "ON_GRID";
  const u = String(raw)
    .trim()
    .toUpperCase()
    .replace(/-/g, "_");
  if (u === "HYBRID" || u === "HIBRIDO" || u === "HÍBRIDO") return "HYBRID";
  if (u === "OFF_GRID" || u === "OFFGRID" || u === "AISLADO") return "OFF_GRID";
  if (u === "ON_GRID" || u === "ONGRID") return "ON_GRID";
  return "ON_GRID";
}

/** Texto orientativo por tipo (resumen / formulario); no sustituye reglas de cotización. */
export const FV_SYSTEM_TYPE_HINTS: Record<
  MarginSystemType,
  { title: string; lines: string[] }
> = {
  ON_GRID: {
    title: "Sistema on grid",
    lines: [
      "Conexión a red eléctrica; excedentes pueden inyectarse según normativa y medición.",
      "No incluye por sí mismo almacenamiento en baterías; el dimensionamiento típico evita ítems solo off-grid/híbrido.",
    ],
  },
  HYBRID: {
    title: "Sistema híbrido",
    lines: [
      "Conexión a red con respaldo o gestión de energía con baterías.",
      "Al crear cotización desde el estudio se consideran bloques de batería y equipos híbridos según plantillas.",
    ],
  },
  OFF_GRID: {
    title: "Sistema off grid",
    lines: [
      "Instalación aislada de la red; baterías y protecciones son parte central del diseño.",
      "Al crear cotización desde el estudio se usan plantillas y validaciones propias de off-grid.",
    ],
  },
};
