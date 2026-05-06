export type AccentPaletteMeta = {
  id: string;
  label: string;
  hint: string;
};

/** Orden de presentación en Preferencias → Colores. */
export const ACCENT_PALETTE_OPTIONS: AccentPaletteMeta[] = [
  { id: "dorado-metal", label: "Dorado metálico", hint: "Identidad clásica de la app (predeterminado)." },
  { id: "naranjo-metal", label: "Naranjo metálico", hint: "Cálido, energía solar." },
  { id: "rojo-metal", label: "Rojo metálico", hint: "Contraste fuerte y llamativo." },
  { id: "azul-metal", label: "Azul metálico", hint: "Técnico y corporativo." },
  { id: "celeste-metal", label: "Celeste metálico", hint: "Fresco y luminoso." },
  { id: "verde-metal", label: "Verde metálico", hint: "FV y sostenibilidad." },
  { id: "gris-metal", label: "Gris metálico", hint: "Neutro con acento sobrio." },
  { id: "azul-klein", label: "Azul Klein", hint: "Azul intenso característico." },
  {
    id: "cromatico-atardecer",
    label: "Cromático atardecer",
    hint: "Escala cálida multicolor (inspiración cromática).",
  },
  {
    id: "cromatico-brisa",
    label: "Cromático brisa",
    hint: "Turquesa a índigo en la escala.",
  },
  {
    id: "complementario-ambar-indigo",
    label: "Ámbar e índigo",
    hint: "Combinación complementaria controlada.",
  },
];

export const DEFAULT_ACCENT_PALETTE_ID = "dorado-metal";

/** Muestra en tarjetas (no depende de variables CSS en el documento). */
export const ACCENT_PALETTE_SWATCH: Record<string, { from: string; to: string }> = {
  "dorado-metal": { from: "#f7d855", to: "#d4a326" },
  "naranjo-metal": { from: "#fb923c", to: "#9a3412" },
  "rojo-metal": { from: "#f87171", to: "#991b1b" },
  "azul-metal": { from: "#60a5fa", to: "#1e40af" },
  "celeste-metal": { from: "#22d3ee", to: "#155e75" },
  "verde-metal": { from: "#34d399", to: "#065f46" },
  "gris-metal": { from: "#94a3b8", to: "#334155" },
  "azul-klein": { from: "#4d6fd4", to: "#001b6b" },
  "cromatico-atardecer": { from: "#fb7185", to: "#86198f" },
  "cromatico-brisa": { from: "#2dd4bf", to: "#4338ca" },
  "complementario-ambar-indigo": { from: "#fbbf24", to: "#4338ca" },
};

const VALID = new Set(ACCENT_PALETTE_OPTIONS.map((p) => p.id));

export function isValidAccentPaletteId(id: string | null | undefined): id is string {
  return typeof id === "string" && VALID.has(id);
}
