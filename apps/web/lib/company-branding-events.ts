/** Disparar tras cambiar logo en Datos de empresa para refrescar sidebar / otras vistas. */
export const COMPANY_BRANDING_CHANGED_EVENT = "pvq:company-branding-changed";

export function notifyCompanyBrandingChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMPANY_BRANDING_CHANGED_EVENT));
}
