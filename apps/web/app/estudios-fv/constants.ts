export const MESES_NOMBRES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const CONNECTION_OPTIONS = [
  { value: "MONOFASICO", label: "Monofásico" },
  { value: "TRIFASICO", label: "Trifásico" },
];

export const PROJECT_TYPE_OPTIONS = [
  { value: "RESIDENCIAL", label: "Residencial" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "INDUSTRIAL", label: "Industrial" },
];

export const REFERENCE_MONTH_OPTIONS = MESES_NOMBRES.map((name, i) => ({
  value: i + 1,
  label: name,
}));

export const CURRENCY_OPTIONS = [
  { value: "CLP", label: "CLP" },
  { value: "USD", label: "USD" },
];

/** Lista clara para mountingType; consistente con backend (MOUNTING_TYPE_VALUES). */
export const MOUNTING_TYPE_OPTIONS = [
  { value: "TECHO", label: "Techo" },
  { value: "SUELO", label: "Suelo" },
  { value: "INCLINADO_FIJO", label: "Inclinado fijo" },
  { value: "SEGUIMIENTO", label: "Seguimiento" },
  { value: "OTRO", label: "Otro" },
];

/** Labels de negocio para tipo de montaje (ficha, Explorador Solar, informes). */
export const MOUNTING_BUSINESS_LABELS: Record<string, string> = {
  TECHO: "Coplanar",
  INCLINADO_FIJO: "Angular",
  SUELO: "Piso",
  SEGUIMIENTO: "Seguimiento",
  OTRO: "Otro",
};

export function getMountingBusinessLabel(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return MOUNTING_BUSINESS_LABELS[value] ?? MOUNTING_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Fuente de generación. INTERNAL, MANUAL y EXPLORADOR_SOLAR activos. */
export const GENERATION_SOURCE_LABELS: Record<string, string> = {
  INTERNAL: "Estimación interna",
  MANUAL: "Generación mensual manual",
  EXPLORADOR_SOLAR: "Explorador Solar",
  EXTERNAL: "Externo (próximamente)",
};

/** Opciones activas para el selector en el formulario. */
export const GENERATION_SOURCE_OPTIONS = [
  { value: "INTERNAL", label: "Estimación interna" },
  { value: "MANUAL", label: "Generación mensual manual" },
  { value: "EXPLORADOR_SOLAR", label: "Explorador Solar" },
];
