"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../../../lib/auth-context";
import { fetchInventoryKpiDashboard, fetchSuiteProjects, type InventoryKpiDashboard, type SuiteProjectRow } from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";

const INVENTARIO = "/vista-previa-suite/logistica/inventario";
const CHART_COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#64748b", "#ec4899", "#14b8a6", "#f43f5e"];

function formatMoney(value: number, currency: string | null): string {
  const cur = currency?.trim() || "CLP";
  try {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(
      value,
    );
  } catch {
    return `${Math.round(value).toLocaleString("es-CL")} ${cur}`;
  }
}

const INDICADORES_PATH = "/vista-previa-suite/logistica/indicadores";

function LogisticaIndicadoresInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId")?.trim() ?? "";

  const { user, loading: authLoading } = useAuth();
  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "logistica"),
    [user?.suiteNavGrants, user?.roles],
  );

  const [projects, setProjects] = useState<SuiteProjectRow[]>([]);
  const [projectId, setProjectId] = useState(urlProjectId);
  const [kpi, setKpi] = useState<InventoryKpiDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plist, dash] = await Promise.all([
        fetchSuiteProjects().catch(() => [] as SuiteProjectRow[]),
        fetchInventoryKpiDashboard({ projectId: projectId.trim() || undefined }),
      ]);
      setProjects(plist);
      setKpi(dash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar indicadores");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setProjectId(urlProjectId);
  }, [urlProjectId]);

  useEffect(() => {
    if (authLoading || !user || !canSee) return;
    void reload();
  }, [authLoading, user, canSee, reload]);

  const barData = useMemo(
    () =>
      (kpi?.byProject ?? []).map((p) => ({
        nombre: (p.projectCode || p.projectName).slice(0, 18),
        cantidad: p.quantitySum,
        lineas: p.lineCount,
      })),
    [kpi?.byProject],
  );

  const pieData = useMemo(
    () =>
      (kpi?.byFamily ?? []).map((f) => ({
        name: f.label.length > 36 ? `${f.label.slice(0, 34)}…` : f.label,
        value: f.lineCount,
        key: f.key,
      })),
    [kpi?.byFamily],
  );

  if (authLoading) {
    return <p className="p-6 text-sm text-slate-600 dark:text-slate-400">Cargando…</p>;
  }
  if (!user) {
    return (
      <p className="p-6 text-sm">
        <Link href="/login" className="text-amber-600 underline">
          Inicie sesión
        </Link>
      </p>
    );
  }
  if (!canSee) {
    return <p className="p-6 text-sm text-slate-600">Sin permiso para logística.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-6">
      <header className="space-y-2 border-b border-slate-200 pb-4 dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Logística</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Indicadores de inventario</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Resumen por proyecto, valor estimado según precios vigentes del catálogo, familias inferidas (paneles OQC vs
              categoría de producto) y líneas ligadas a productos que no están en estado activo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="whitespace-nowrap">Proyecto</span>
              <select
                value={projectId}
                onChange={(e) => {
                  const v = e.target.value;
                  setProjectId(v);
                  const sp = new URLSearchParams(searchParams.toString());
                  if (v.trim()) sp.set("projectId", v.trim());
                  else sp.delete("projectId");
                  const q = sp.toString();
                  router.replace(q ? `${INDICADORES_PATH}?${q}` : INDICADORES_PATH);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">Todos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Actualizar
            </button>
            <Link
              href={projectId ? `${INVENTARIO}?projectId=${encodeURIComponent(projectId)}` : INVENTARIO}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Ver inventario
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      ) : null}

      {loading || !kpi ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Cargando datos…</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Líneas de inventario"
              value={String(kpi.totals.lineCount)}
              hint="Filas en el modelo (p. ej. un serial = una línea)"
            />
            <KpiCard
              title="Cantidad acumulada"
              value={kpi.totals.quantitySum.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
              hint="Suma de campo cantidad"
            />
            <KpiCard
              title="Valor estimado en stock"
              value={formatMoney(kpi.totals.estimatedStockValue, kpi.totals.valuationCurrency)}
              hint={
                kpi.totals.valuationCurrency
                  ? "Coste > compra > precio lista × cantidad (misma moneda)"
                  : "Varias monedas o líneas sin precio vigente mezcladas"
              }
            />
            <KpiCard
              title="Alertas de catálogo"
              value={`${kpi.totals.linesWithoutLinkedProduct} sin / ${kpi.totals.linesWithNonActiveCatalogProduct} no activo`}
              hint="Sin producto enlazado · producto no ACTIVO"
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Cantidad por proyecto
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Eje horizontal: código o nombre abreviado.</p>
              <div className="mt-4 h-72 w-full min-w-0">
                {barData.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="nombre" tick={{ fontSize: 10 }} angle={-28} textAnchor="end" interval={0} height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={(v, name) => [
                          typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? "—"),
                          name === "cantidad" ? "Cantidad" : String(name ?? ""),
                        ]}
                      />
                      <Bar dataKey="cantidad" fill="#0ea5e9" name="cantidad" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Líneas por familia (inferida)
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Paneles OQC por serial vs resto por categoría de catálogo vs sin clasificar.
              </p>
              <div className="mt-4 h-72 w-full min-w-0">
                {pieData.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={entry.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${typeof v === "number" ? v : v ?? "—"} líneas`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Líneas con mayor valor estimado
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    <th className="py-2 pr-2">Producto / nombre</th>
                    <th className="py-2 pr-2">Cantidad</th>
                    <th className="py-2">Valor línea</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi.topLinesByEstimatedValue.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-slate-500">
                        Sin líneas valoradas (enlace a catálogo y precio vigente).
                      </td>
                    </tr>
                  ) : (
                    kpi.topLinesByEstimatedValue.map((row) => (
                      <tr key={row.inventoryItemId} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-2 text-slate-800 dark:text-slate-200">
                          <span className="font-medium">{row.productName ?? "—"}</span>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{row.name}</div>
                        </td>
                        <td className="py-2 pr-2 tabular-nums">{row.quantity.toLocaleString("es-CL")}</td>
                        <td className="py-2 tabular-nums font-medium text-slate-900 dark:text-slate-100">
                          {formatMoney(row.estimatedLineValue, row.currency ?? kpi.totals.valuationCurrency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
              Productos «detenidos» (no activos en catálogo)
            </h2>
            <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/90">
              Estado distinto de ACTIVO (descontinuado, bajo revisión, etc.). Conviene revisar o sustituir en inventario.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-amber-300/80 text-xs uppercase text-amber-900/70 dark:border-amber-800 dark:text-amber-200/80">
                    <th className="py-2 pr-2">Producto</th>
                    <th className="py-2 pr-2">Estado</th>
                    <th className="py-2 pr-2">Líneas</th>
                    <th className="py-2">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi.nonActiveProductHold.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-amber-900/80 dark:text-amber-200/80">
                        No hay líneas enlazadas a productos fuera de ACTIVO.
                      </td>
                    </tr>
                  ) : (
                    kpi.nonActiveProductHold.map((row) => (
                      <tr key={row.productId} className="border-b border-amber-200/60 dark:border-amber-900/40">
                        <td className="py-2 pr-2 font-medium text-amber-950 dark:text-amber-50">{row.productName}</td>
                        <td className="py-2 pr-2">{row.commercialStatus}</td>
                        <td className="py-2 pr-2 tabular-nums">{row.lineCount}</td>
                        <td className="py-2 tabular-nums">{row.quantitySum.toLocaleString("es-CL")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-950/40">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Cómo ordenar paneles, estructuras, inversores y BOS</h2>
            <div className="mt-3 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <p>
                <strong>Un solo modelo de fila, varias «familias».</strong> En base de datos todo vive en{" "}
                <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-800">InventoryItem</code>: cantidad,
                proyecto, enlace opcional a <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-800">Product</code> del
                catálogo y metadatos flexibles en <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-800">linksJson</code>
                (por ejemplo trazabilidad OQC por serial en paneles).
              </p>
              <p>
                <strong>No fuerce una sola grilla de columnas técnicas.</strong> La ficha técnica de un panel (Vmp, Isc, serial)
                no coincide con la de un inversor ni con la de un tracker. La forma ordenada es:{" "}
                <em>misma tabla</em>, pero <em>vistas o importaciones por familia</em> (pestañas o filtros) donde cada una muestra
                las columnas que aplican a ese tipo. Los paneles OQC ya usan{" "}
                <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-800">traceability: OQC_SERIAL_PANEL</code>; para
                estructuras, cables o inversores conviene nuevos valores de trazabilidad o importadores dedicados que rellenen solo
                los campos relevantes en <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-800">linksJson</code> y el
                enlace al <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-800">Product</code> cuando exista en
                catálogo.
              </p>
              <p>
                <strong>Inventario «real» del proyecto CSO.</strong> Suma paneles (ya cargados) + estructuras + BOS + inversores
                como líneas distintas; los KPI de esta pantalla agregan por proyecto y por familia inferida para que vea el mix
                aunque cada tipo tenga columnas distintas en detalle.
              </p>
            </div>
          </section>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generado {new Date(kpi.generatedAt).toLocaleString("es-CL")}
            {kpi.projectIdFilter ? ` · filtro proyecto ${kpi.projectIdFilter}` : ""}.
          </p>
        </>
      )}
    </div>
  );
}

function KpiCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

export default function LogisticaIndicadoresPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600 dark:text-slate-400">Cargando indicadores…</p>}>
      <LogisticaIndicadoresInner />
    </Suspense>
  );
}
