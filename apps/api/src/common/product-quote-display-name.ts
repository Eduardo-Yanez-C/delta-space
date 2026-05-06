/**
 * Nombre que debe mostrarse en cotizaciones para un producto de catálogo:
 * siempre el nombre comercial (`Product.name`), nunca modelo ni descripción técnica.
 */
export function commercialNameForQuoteLine(product: { name: string }): string {
  const n = product.name?.trim();
  return n && n.length > 0 ? n : "—";
}
