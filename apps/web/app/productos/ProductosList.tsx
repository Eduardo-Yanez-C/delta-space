"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCan } from "../../lib/useCan";
import {
  fetchProducts,
  fetchCategories,
  fetchBrands,
  fetchSuppliers,
  type Product,
  type ProductFilters,
  type Category,
  type Brand,
  type Supplier,
} from "../../lib/api";
import { CommercialStatusBadge, SupplyOriginBadge } from "../../components/ui/Badge";

const PRODUCTOS_TABLE_LS = "pv_quoting_productos_table_col_widths_v1";

/** min/max evitan columnas ilegibles; defaultWidth da una base cómoda antes de redimensionar. */
const COLS = [
  { key: "codeSku", label: "Código / SKU", hint: "Código interno y SKU", defaultWidth: 184, min: 80, max: 420 },
  { key: "name", label: "Nombre", hint: "Nombre comercial del producto", defaultWidth: 280, min: 160, max: 640 },
  { key: "category", label: "Categoría", hint: "Rubro del catálogo", defaultWidth: 168, min: 112, max: 360 },
  { key: "brandModel", label: "Marca / modelo", hint: "Marca y modelo", defaultWidth: 200, min: 128, max: 420 },
  { key: "supplier", label: "Proveedor", hint: "Proveedor principal", defaultWidth: 220, min: 140, max: 480 },
  { key: "origin", label: "Origen", hint: "Origen de abastecimiento (Nacional / Internacional)", defaultWidth: 124, min: 96, max: 220 },
  { key: "currency", label: "Moneda", hint: "Moneda base", defaultWidth: 96, min: 72, max: 160 },
  { key: "status", label: "Estado", hint: "Estado comercial", defaultWidth: 132, min: 104, max: 240 },
  { key: "actions", label: "Acciones", hint: "Ver o editar", defaultWidth: 144, min: 120, max: 220 },
] as const;

type ColKey = (typeof COLS)[number]["key"];

function colCfg(key: ColKey) {
  return COLS.find((c) => c.key === key)!;
}

function defaultColWidths(): Record<ColKey, number> {
  return Object.fromEntries(COLS.map((c) => [c.key, c.defaultWidth])) as Record<ColKey, number>;
}

function clampColWidth(key: ColKey, w: number): number {
  const c = colCfg(key);
  return Math.round(Math.max(c.min, Math.min(c.max, w)));
}

function mergeStoredWidths(parsed: unknown): Record<ColKey, number> {
  const base = defaultColWidths();
  if (!parsed || typeof parsed !== "object") return base;
  const o = parsed as Record<string, unknown>;
  for (const c of COLS) {
    const w = o[c.key];
    if (typeof w === "number" && Number.isFinite(w)) {
      base[c.key] = clampColWidth(c.key, w);
    }
  }
  return base;
}

function loadColWidthsFromStorage(): Record<ColKey, number> {
  if (typeof window === "undefined") return defaultColWidths();
  try {
    const raw = localStorage.getItem(PRODUCTOS_TABLE_LS);
    if (!raw) return defaultColWidths();
    return mergeStoredWidths(JSON.parse(raw));
  } catch {
    return defaultColWidths();
  }
}

function categoryFilterTitle(id: number | undefined, list: Category[]): string {
  if (id == null) return "Todas las categorías";
  return list.find((c) => c.id === id)?.name ?? "Categoría";
}

function brandFilterTitle(id: number | undefined, list: Brand[]): string {
  if (id == null) return "Todas las marcas";
  return list.find((b) => b.id === id)?.name ?? "Marca";
}

function supplierFilterTitle(sid: string | undefined, list: Supplier[]): string {
  if (!sid) return "Cualquier proveedor";
  return list.find((s) => s.id === sid)?.name ?? "Proveedor";
}

export function ProductosList() {
  const canEdit = useCan("edit", "product");
  const canCreate = useCan("create", "product");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductFilters>({});
  const [search, setSearch] = useState("");
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(defaultColWidths);
  const [viewMsg, setViewMsg] = useState<string | null>(null);
  const [resizingCol, setResizingCol] = useState<ColKey | null>(null);

  useEffect(() => {
    setColWidths(loadColWidthsFromStorage());
  }, []);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchBrands(), fetchSuppliers()])
      .then(([cat, br, sup]) => {
        setCategories(cat);
        setBrands(br);
        setSuppliers(sup);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts({ ...filters, search: search || undefined })
      .then(setProducts)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [filters, search]);

  const saveTableView = useCallback(() => {
    try {
      localStorage.setItem(PRODUCTOS_TABLE_LS, JSON.stringify(colWidths));
      setViewMsg("Vista guardada en este equipo.");
      window.setTimeout(() => setViewMsg(null), 2800);
    } catch {
      setViewMsg("No se pudo guardar la vista.");
      window.setTimeout(() => setViewMsg(null), 3500);
    }
  }, [colWidths]);

  const beginColumnResize = useCallback((e: React.MouseEvent, colKey: ColKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[colKey];
    setResizingCol(colKey);

    const onMove = (ev: MouseEvent) => {
      const w = clampColWidth(colKey, startW + ev.clientX - startX);
      setColWidths((prev) => ({ ...prev, [colKey]: w }));
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizingCol(null);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths]);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="productos-buscar"
              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Buscar
            </label>
            <input
              id="productos-buscar"
              type="search"
              placeholder="Nombre, código interno o SKU…"
              title="Filtra por nombre comercial, código interno o SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full min-w-0 max-w-full sm:max-w-md lg:max-w-xl xl:max-w-2xl"
            />
          </div>

          {/* Filtros: auto-fill + minmax evita 6 columnas apretadas que chocan con min-width de los selects */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-5">
            <div
              className="grid min-w-0 flex-1 gap-x-4 gap-y-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 13.75rem), 1fr))",
              }}
            >
              <div className="min-w-0">
                <label
                  htmlFor="productos-categoria"
                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Categoría
                </label>
                <select
                  id="productos-categoria"
                  value={filters.categoryId ?? ""}
                  title={categoryFilterTitle(filters.categoryId, categories)}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      categoryId: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="input-field w-full min-w-0 text-sm"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="productos-marca"
                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Marca
                </label>
                <select
                  id="productos-marca"
                  value={filters.brandId ?? ""}
                  title={brandFilterTitle(filters.brandId, brands)}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      brandId: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="input-field w-full min-w-0 text-sm"
                >
                  <option value="">Todas las marcas</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="productos-proveedor"
                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Proveedor
                </label>
                <select
                  id="productos-proveedor"
                  value={filters.supplierId ?? ""}
                  title={supplierFilterTitle(filters.supplierId, suppliers)}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      supplierId: e.target.value || undefined,
                    }))
                  }
                  className="input-field w-full min-w-0 text-sm"
                >
                  <option value="">Cualquier proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="productos-origen"
                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Origen
                </label>
                <select
                  id="productos-origen"
                  value={filters.supplyOrigin ?? ""}
                  title="Nacional o internacional (según proveedor principal)"
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      supplyOrigin: e.target.value || undefined,
                    }))
                  }
                  className="input-field w-full min-w-0 text-sm"
                >
                  <option value="">Cualquier origen</option>
                  <option value="NACIONAL">Nacional</option>
                  <option value="INTERNACIONAL">Internacional</option>
                </select>
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="productos-estado"
                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Estado
                </label>
                <select
                  id="productos-estado"
                  value={filters.commercialStatus ?? ""}
                  title="Estado comercial del producto"
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      commercialStatus: e.target.value || undefined,
                    }))
                  }
                  className="input-field w-full min-w-0 text-sm"
                >
                  <option value="">Cualquier estado</option>
                  <option value="ACTIVO">Activo</option>
                  <option value="DESCONTINUADO">Descontinuado</option>
                  <option value="BAJO_REVISION">En revisión</option>
                </select>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-end sm:border-t-0 sm:pt-0 lg:flex-col lg:items-stretch lg:justify-end lg:border-l lg:border-t-0 lg:pl-5 dark:border-slate-600">
              {viewMsg ? (
                <span className="text-xs text-emerald-700 dark:text-emerald-300" role="status">
                  {viewMsg}
                </span>
              ) : null}
              <button type="button" className="btn-secondary whitespace-nowrap py-2 text-sm" onClick={saveTableView}>
                Guardar vista
              </button>
            </div>
          </div>
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600 dark:border-slate-600 dark:text-slate-400">
          Entre columnas verá una{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">línea vertical</span> resaltada al pasar el
          ratón: arrástrela para ajustar el ancho. Pulse <span className="font-medium">Guardar vista</span> para
          conservar los anchos en este equipo.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center p-12">
          <span className="text-slate-500 dark:text-slate-400">Cargando productos…</span>
        </div>
      ) : (
        <div className="card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-slate-200 dark:divide-slate-700">
              <colgroup>
                {COLS.map((c) => (
                  <col key={c.key} style={{ width: colWidths[c.key], minWidth: c.min }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm dark:bg-slate-800/95 dark:shadow-slate-900/50">
                <tr>
                  {COLS.map((c) => {
                    const active = resizingCol === c.key;
                    return (
                      <th
                        key={c.key}
                        title={c.hint}
                        className={`relative border-b border-slate-200 px-3 py-3 align-bottom text-xs font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-100 ${
                          c.key === "actions" ? "text-right" : "text-left"
                        }`}
                        style={{ width: colWidths[c.key], minWidth: c.min }}
                      >
                        <span
                          className={`block leading-snug ${
                            c.key === "actions" ? "pr-2 text-right" : `pr-3 ${c.key === "name" ? "line-clamp-2" : ""}`
                          }`}
                        >
                          {c.label}
                        </span>
                        {/* Handle de resize: zona ancha + línea visible; feedback hover y drag */}
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-hidden
                          tabIndex={-1}
                          title={`Redimensionar columna «${c.label}»`}
                          className="group absolute top-0 -right-1 z-[2] flex h-full w-4 cursor-col-resize select-none items-stretch justify-center pl-0.5"
                          onMouseDown={(e) => beginColumnResize(e, c.key)}
                        >
                          <span
                            className={`my-2 shrink-0 rounded-full transition-all duration-150 ${
                              active
                                ? "w-[3px] bg-primary-600 ring-2 ring-primary-500/35 dark:bg-primary-500 dark:ring-primary-400/40"
                                : "w-px bg-slate-400/90 group-hover:w-[3px] group-hover:bg-primary-600/90 group-hover:shadow-sm dark:bg-slate-500 dark:group-hover:bg-primary-500"
                            }`}
                          />
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      <p>No hay productos que coincidan con los filtros.</p>
                      {canCreate && (
                        <Link href="/productos/nuevo" className="btn-primary mt-3 inline-block">
                          Crear producto
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const brandModelText = `${p.brandNameFree ?? p.brand?.name ?? "—"}${
                      p.modelNameFree ?? p.model?.name ? ` / ${p.modelNameFree ?? p.model?.name}` : ""
                    }`;
                    const codeSkuText = `${p.internalCode ?? "—"}${p.sku ? ` / ${p.sku}` : ""}`;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td
                          className="border-b border-slate-100 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700/80 dark:text-slate-400"
                          title={codeSkuText}
                        >
                          <span className="line-clamp-2 break-words">{codeSkuText}</span>
                        </td>
                        <td
                          className="border-b border-slate-100 px-3 py-2.5 text-sm dark:border-slate-700/80"
                          title={p.name}
                        >
                          <span className="line-clamp-2 font-medium break-words text-slate-900 dark:text-slate-100">
                            {p.name}
                          </span>
                        </td>
                        <td
                          className="border-b border-slate-100 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700/80 dark:text-slate-400"
                          title={p.category?.name ?? undefined}
                        >
                          <span className="line-clamp-2 break-words">{p.category?.name ?? "—"}</span>
                        </td>
                        <td
                          className="border-b border-slate-100 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700/80"
                          title={brandModelText}
                        >
                          <span className="line-clamp-2 break-words">{brandModelText}</span>
                        </td>
                        <td
                          className="border-b border-slate-100 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700/80 dark:text-slate-400"
                          title={p.primarySupplier?.name ?? undefined}
                        >
                          <span className="line-clamp-2 break-words">{p.primarySupplier?.name ?? "—"}</span>
                        </td>
                        <td
                          className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-700/80"
                          title={
                            p.primarySupplier
                              ? p.primarySupplier.supplyOrigin === "NACIONAL"
                                ? "Origen nacional"
                                : "Origen internacional"
                              : undefined
                          }
                        >
                          {p.primarySupplier ? (
                            <SupplyOriginBadge origin={p.primarySupplier.supplyOrigin} />
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td
                          className="border-b border-slate-100 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700/80 dark:text-slate-400"
                          title={p.defaultCurrency ?? undefined}
                        >
                          {p.defaultCurrency ?? "—"}
                        </td>
                        <td
                          className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-700/80"
                          title={p.commercialStatus}
                        >
                          <CommercialStatusBadge status={p.commercialStatus} />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2.5 text-right dark:border-slate-700/80">
                          <Link href={`/productos/${p.id}`} className="text-amber-600 hover:underline">
                            Ver
                          </Link>
                          {canEdit && (
                            <>
                              <span className="mx-1.5 text-slate-300 dark:text-slate-600" aria-hidden>
                                ·
                              </span>
                              <Link href={`/productos/${p.id}/editar`} className="text-slate-600 hover:underline">
                                Editar
                              </Link>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
