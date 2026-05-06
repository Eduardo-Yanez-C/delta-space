/**
 * Valores de `linksJson.traceability` para clasificar filas de inventario sin duplicar tablas.
 *
 * **Paneles (OQC):** medidas eléctricas por serial — ver `oqc-serial-item-builder.ts`.
 *
 * **BOM proveedor (ej. Mibet Cerro Sombrero):** una fila por componente de lista de materiales.
 * Campos recomendados en `linksJson` (además de `traceability`):
 * - `supplierName` (string), `supplierQuoteRef` (string, ej. PJ-251029-06)
 * - `bomLineNo` (number), `materialGrade` (string), `specText` (string)
 * - `spareQty` (number), `qtyPerKit` / `unitKit` (number) si la tabla los trae
 * - `unitWeightKg` / `totalWeightKg` (number) si aplica
 * - `componentLabel` (string, ej. traducción de ítem de la cotización)
 */
export const INVENTORY_TRACEABILITY = {
  OQC_SERIAL_PANEL: "OQC_SERIAL_PANEL",
  SUPPLIER_BOM_LINE: "SUPPLIER_BOM_LINE",
} as const;

export type InventoryTraceabilityKind = (typeof INVENTORY_TRACEABILITY)[keyof typeof INVENTORY_TRACEABILITY];
