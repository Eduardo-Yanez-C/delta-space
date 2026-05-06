"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commercialNameForQuoteLine = commercialNameForQuoteLine;
/**
 * Nombre que debe mostrarse en cotizaciones para un producto de catálogo:
 * siempre el nombre comercial (`Product.name`), nunca modelo ni descripción técnica.
 */
function commercialNameForQuoteLine(product) {
    const n = product.name?.trim();
    return n && n.length > 0 ? n : "—";
}
