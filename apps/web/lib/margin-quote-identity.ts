/**
 * Identidad comercial neutra para cotizaciones quoteKind === "MARGIN".
 * Copy acordado: visible en detalle, vista previa e impresión/PDF.
 */
export const MARGIN_QUOTE_SUBTITLE = "Cotización con margen";

export const MARGIN_QUOTE_TAGLINE =
  "Incluye referencias económicas para gestión comercial.";

/** Clases reutilizables (Tailwind) para banda / tarjeta MARGIN */
export const marginQuoteBannerClass =
  "rounded-lg border border-violet-200/90 bg-[var(--margin-quote-surface)] px-3 py-2.5 dark:border-violet-800/50";

export const marginQuoteSubtitleTextClass =
  "text-sm font-semibold text-[var(--margin-quote-accent-foreground)] dark:text-violet-100";

export const marginQuoteTaglineTextClass =
  "mt-0.5 text-xs leading-snug text-violet-800/90 dark:text-violet-200/90";
