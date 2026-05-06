import type { Category, Product } from "./api";

/**
 * Categorías del catálogo típico de planta / obra fotovoltaica (equipos, BOP y servicios de campo).
 * Alineado a los slugs sembrados en `apps/api/prisma/seed.ts`.
 */
export const FV_PLANT_CATEGORY_SLUGS = new Set([
  "paneles-fotovoltaicos",
  "inversores-on-grid",
  "inversores-hibridos",
  "inversores-off-grid",
  "baterias",
  "estructuras",
  "protecciones-ac",
  "protecciones-dc",
  "cables",
  "conectores",
  "tableros",
  "monitoreo",
  "ingenieria",
  "mano-de-obra",
  "transporte",
  "obras-civiles",
  "permisos",
]);

export function flattenProductCategories(cats: Category[]): Category[] {
  const out: Category[] = [];
  const seen = new Set<number>();
  const walk = (arr: Category[]) => {
    for (const c of arr) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      if (c.children?.length) walk(c.children);
    }
  };
  walk(cats);
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export type InventoryProductPickerMode = "fv_plant" | "all";

export function filterProductsForInventoryPicker(
  products: Product[],
  opts: { mode: InventoryProductPickerMode; categoryId: number | null; search: string },
): Product[] {
  let rows = products;
  if (opts.categoryId != null) {
    rows = rows.filter((p) => p.categoryId === opts.categoryId);
  } else if (opts.mode === "fv_plant") {
    rows = rows.filter((p) => {
      const s = p.category?.slug;
      return s != null && FV_PLANT_CATEGORY_SLUGS.has(s);
    });
  }
  const t = opts.search.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter(
    (p) =>
      (p.name ?? "").toLowerCase().includes(t) ||
      (p.sku ?? "").toLowerCase().includes(t) ||
      (p.internalCode ?? "").toLowerCase().includes(t),
  );
}
