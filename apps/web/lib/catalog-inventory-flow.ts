/**
 * Conecta el alta de producto en Ventas (`/productos/nuevo`) con Logística · Inventario.
 * Un solo flujo de catálogo: ficha + precio obligatorio; luego vuelta a inventario para vincular stock.
 */
export const CATALOG_FLOW_FROM_LOGISTICA_INVENTORY = "logistica-inventory";

export const QUERY_LINK_PRODUCT = "linkProduct";
export const QUERY_INVENTORY_PROJECT_ID = "inventoryProjectId";

export function buildProductosNuevoHref(opts: { inventoryProjectId?: string | null }): string {
  const q = new URLSearchParams();
  q.set("from", CATALOG_FLOW_FROM_LOGISTICA_INVENTORY);
  const pid = opts.inventoryProjectId?.trim();
  if (pid) q.set(QUERY_INVENTORY_PROJECT_ID, pid);
  return `/productos/nuevo?${q.toString()}`;
}

export function buildLogisticaInventarioLinkProductHref(productId: string, inventoryProjectId?: string | null): string {
  const q = new URLSearchParams();
  q.set(QUERY_LINK_PRODUCT, productId);
  const pid = inventoryProjectId?.trim();
  if (pid) q.set("projectId", pid);
  return `/vista-previa-suite/logistica/inventario?${q.toString()}`;
}
