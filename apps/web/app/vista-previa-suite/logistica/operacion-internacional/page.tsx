"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../lib/auth-context";
import {
  deleteLogisticsSnapshot,
  downloadLogisticsSnapshotExport,
  fetchLogisticsSnapshotDetail,
  fetchLogisticsSnapshots,
  fetchSuiteProjects,
  importLogisticsInternationalExcel,
  patchLogisticsSnapshotPallets,
  patchLogisticsSnapshotShipments,
  patchLogisticsSnapshotTransport,
  type LogisticsSnapshotDetail,
  type LogisticsSnapshotListRow,
  type SuiteProjectRow,
} from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";

const INVENTARIO = "/vista-previa-suite/logistica/inventario";

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function TablePreview({
  rows,
  maxRows,
  keys,
}: {
  rows: Record<string, unknown>[];
  maxRows: number;
  keys: string[];
}) {
  const slice = rows.slice(0, maxRows);
  if (!slice.length) return <p className="text-sm text-slate-500 dark:text-slate-400">Sin filas.</p>;
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
          <tr>
            {keys.map((k) => (
              <th key={k} className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-200">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slice.map((row, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-700/80">
              {keys.map((k) => (
                <td key={k} className="whitespace-nowrap px-2 py-1 text-slate-700 dark:text-slate-300">
                  {formatCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows ? (
        <p className="border-t border-slate-200 p-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Mostrando {maxRows} de {rows.length} filas. Exporte desde Excel para el listado completo.
        </p>
      ) : null}
    </div>
  );
}

function inferKeys(rows: Record<string, unknown>[], preferred: string[]): string[] {
  const first = rows[0];
  if (!first) return preferred;
  const set = new Set<string>([...preferred, ...Object.keys(first)]);
  return [...set].filter((k) => k in first || preferred.includes(k));
}

function pickShipmentFinanceKeys(rows: Record<string, unknown>[]): string[] {
  const first = rows[0];
  if (!first) return [];
  return Object.keys(first).filter((k) => {
    if (k.startsWith("_c")) return false;
    const low = k.toLowerCase();
    return /embarque|categor|proveedor|factura|monto|pago|usd|fecha|estado|anticipo|saldo|bl\b|naviera|contenedor|bulto|peso/i.test(
      low,
    );
  });
}

function rowEmbarqueLabel(row: Record<string, unknown>): string {
  const k = Object.keys(row).find((x) => /embarque|id\b/i.test(x) && !/estado/i.test(x));
  if (!k) return "—";
  return formatCell(row[k]);
}

function computePaymentAlerts(shipments: Record<string, unknown>[]): string[] {
  const out: string[] = [];
  for (const row of shipments) {
    const label = rowEmbarqueLabel(row);
    for (const [key, val] of Object.entries(row)) {
      const lowK = key.toLowerCase();
      const lowV = String(val ?? "").toLowerCase();
      if (!lowV.includes("pendiente")) continue;
      if (/estado|pago|anticipo|saldo|factura/i.test(lowK)) {
        out.push(`${label}: ${key} → ${String(val)}`);
      }
    }
  }
  return out.slice(0, 20);
}

type LogisticaOpTab = "resumen" | "trazabilidad" | "finanzas" | "pallets" | "paneles" | "embarques" | "transporte";

const LOGISTICA_TAB_VALUES: LogisticaOpTab[] = [
  "resumen",
  "trazabilidad",
  "finanzas",
  "pallets",
  "paneles",
  "embarques",
  "transporte",
];

function parseLogisticaTabParam(raw: string): LogisticaOpTab | null {
  const t = raw.trim();
  return LOGISTICA_TAB_VALUES.includes(t as LogisticaOpTab) ? (t as LogisticaOpTab) : null;
}

function OperacionInternacionalInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const urlProjectId = searchParams.get("projectId")?.trim() ?? "";
  const urlSnapshotId = searchParams.get("snapshotId")?.trim() ?? "";
  const urlLogisticaTab = searchParams.get("logisticaTab")?.trim() ?? "";
  const { user, loading: authLoading } = useAuth();
  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "logistica"),
    [user?.suiteNavGrants, user?.roles],
  );
  const canWrite = useMemo(() => {
    const r = user?.roles ?? [];
    return ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "INGENIERIA", "VENTAS"].some((x) => r.includes(x));
  }, [user?.roles]);

  const [projects, setProjects] = useState<SuiteProjectRow[]>([]);
  const [snapshots, setSnapshots] = useState<LogisticsSnapshotListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(urlProjectId);
  const [detail, setDetail] = useState<LogisticsSnapshotDetail | null>(null);
  const [tab, setTab] = useState<LogisticaOpTab>("resumen");
  const [importing, setImporting] = useState(false);
  const [draftShipments, setDraftShipments] = useState<Record<string, unknown>[]>([]);
  const [draftPallets, setDraftPallets] = useState<Record<string, unknown>[]>([]);
  const [draftTransport, setDraftTransport] = useState<Record<string, unknown>[]>([]);
  const [savingShipments, setSavingShipments] = useState(false);
  const [savingPallets, setSavingPallets] = useState(false);
  const [savingTransport, setSavingTransport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);

  const paymentAlerts = useMemo(() => computePaymentAlerts((detail?.shipments ?? []) as Record<string, unknown>[]), [detail?.shipments]);

  useEffect(() => {
    if (!detail) {
      setDraftShipments([]);
      setDraftPallets([]);
      setDraftTransport([]);
      return;
    }
    setDraftShipments(JSON.parse(JSON.stringify(detail.shipments)) as Record<string, unknown>[]);
    setDraftPallets(JSON.parse(JSON.stringify(detail.pallets)) as Record<string, unknown>[]);
    setDraftTransport(JSON.parse(JSON.stringify(detail.groundTransport)) as Record<string, unknown>[]);
  }, [detail?.id, detail?.updatedAt]);

  const financeKeys = useMemo(() => pickShipmentFinanceKeys(draftShipments), [draftShipments]);

  const palletEditKeys = useMemo(
    () =>
      inferKeys(draftPallets, [
        "N° Pallet (ID)",
        "Contenedor",
        "Estado",
        "Cantidad Paneles",
        "Potencia Total (W)",
        "Potencia Promedio (W)",
        "Fecha Salida China",
        "Fecha Llegada Chile",
        "Fecha Desconsolidación",
        "Fecha Salida Coyhaique",
        "Fecha Llegada Coyhaique",
        "Días Marítimos",
        "Días a Coyhaique",
        "Trazabilidad Completa",
        "Fuente PDF",
        "Observaciones",
      ]),
    [draftPallets],
  );
  const transportEditKeys = useMemo(
    () =>
      inferKeys(draftTransport, [
        "Seq.",
        "N° Pallet (ID)",
        "Contenedor",
        "Estado",
        "Transportista",
        "Conductor",
        "RUT Conductor",
        "Patente Camión",
        "Patente Rampla",
        "Fecha Despacho Real",
        "Observ. Transporte",
        "Fecha Salida Coyhaique",
        "Fecha Llegada Coyhaique",
        "Días en Ruta",
      ]),
    [draftTransport],
  );

  const reloadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plist, snaps] = await Promise.all([
        fetchSuiteProjects().catch(() => [] as SuiteProjectRow[]),
        fetchLogisticsSnapshots(),
      ]);
      setProjects(plist);
      setSnapshots(snaps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (urlProjectId && !projectId) setProjectId(urlProjectId);
  }, [urlProjectId, projectId]);

  useEffect(() => {
    if (authLoading || !user || !canSee) return;
    void reloadList();
  }, [authLoading, user, canSee, reloadList]);

  useEffect(() => {
    if (!urlSnapshotId || authLoading || !user || !canSee) return;
    let cancelled = false;
    setError(null);
    void fetchLogisticsSnapshotDetail(urlSnapshotId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        const t = parseLogisticaTabParam(urlLogisticaTab);
        setTab(t ?? "resumen");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar detalle");
      });
    return () => {
      cancelled = true;
    };
  }, [urlSnapshotId, urlLogisticaTab, authLoading, user, canSee]);

  async function onPickDetail(id: string) {
    setError(null);
    try {
      const d = await fetchLogisticsSnapshotDetail(id);
      setDetail(d);
      setTab("resumen");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar detalle");
    }
  }

  async function onSaveShipments() {
    if (!detail || !canWrite) return;
    setSavingShipments(true);
    setError(null);
    try {
      const updated = await patchLogisticsSnapshotShipments(detail.id, draftShipments);
      setDetail(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingShipments(false);
    }
  }

  async function onSavePallets() {
    if (!detail || !canWrite) return;
    setSavingPallets(true);
    setError(null);
    try {
      const updated = await patchLogisticsSnapshotPallets(detail.id, draftPallets);
      setDetail(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar pallets");
    } finally {
      setSavingPallets(false);
    }
  }

  async function onSaveTransport() {
    if (!detail || !canWrite) return;
    setSavingTransport(true);
    setError(null);
    try {
      const updated = await patchLogisticsSnapshotTransport(detail.id, draftTransport);
      setDetail(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar transporte");
    } finally {
      setSavingTransport(false);
    }
  }

  async function onExport() {
    if (!detail) return;
    setExporting(true);
    setError(null);
    try {
      await downloadLogisticsSnapshotExport(detail.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  async function onImport(file: File | null) {
    if (!file || !canWrite) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importLogisticsInternationalExcel(file, projectId.trim() || null);
      await reloadList();
      await onPickDetail(res.snapshot.id);
      setTab("resumen");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  async function onDeleteSnapshot(snapshotId: string) {
    if (!canWrite) return;
    const ok = window.confirm(
      "¿Eliminar esta importación? Se borrará el registro y los ítems de inventario vinculados (p. ej. SKU LOG-INT-…). Esta acción no se puede deshacer.",
    );
    if (!ok) return;
    setDeletingSnapshotId(snapshotId);
    setError(null);
    try {
      await deleteLogisticsSnapshot(snapshotId);
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      if (detail?.id === snapshotId) {
        setDetail(null);
        const sp = new URLSearchParams(searchParams.toString());
        sp.delete("snapshotId");
        sp.delete("logisticaTab");
        const q = sp.toString();
        router.replace(q ? `${pathname}?${q}` : pathname);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingSnapshotId(null);
    }
  }

  if (authLoading || (!user && !error)) {
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

  const s = detail?.summary;

  const panelKeys = inferKeys(detail?.panels ?? [], [
    "N° Ítem",
    "Número de Serie",
    "Pm (W)",
    "N° Pallet (ID)",
    "Contenedor",
    "Estado",
    "Fecha Llegada Chile",
  ]);
  const shipKeys = inferKeys(detail?.shipments ?? [], [
    "🔒 ID Embarque",
    "🔒 Categoría",
    "🔒 Proveedor",
    "🔒 N° Factura / Contrato",
    "Monto Total USD",
    "🔒 ⚙ Estado Logístico AUTO",
    "🔒 ⚙ Estado Pago AUTO",
  ]);
  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 pb-16 md:p-6">
      <header className="space-y-2 border-b border-slate-200 pb-6 dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa de suite</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Operación internacional</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Importe su control de importación (hojas <strong className="font-normal">Base Paneles</strong>,{" "}
              <strong className="font-normal">Base Pallets</strong>, <strong className="font-normal">Datos Base</strong> y{" "}
              <strong className="font-normal">Registro Transporte</strong>): el lector admite cabeceras en varias filas
              como en Excel. La pestaña <strong className="font-normal">Trazabilidad</strong> cruza pallet → paneles →
              viaje terrestre (Coyhaique) y muestra si los hitos coinciden con su columna «Trazabilidad completa». Se crea un
              ítem de inventario vinculado con SKU{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">LOG-INT-N-…</code>.{" "}
              <Link href={INVENTARIO} className="font-medium text-amber-700 underline dark:text-amber-400">
                Ir a inventario
              </Link>
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Importar Excel</h2>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Proyecto destino (opcional)</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          >
            <option value="">— Sin proyecto (stock general en inventario) —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Archivo .xlsx</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={!canWrite || importing}
            onChange={(e) => void onImport(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          {!canWrite ? <p className="text-xs text-slate-500">Su rol no permite importar.</p> : null}
          {importing ? <p className="text-sm text-amber-700 dark:text-amber-400">Importando (puede tardar unos segundos)…</p> : null}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Importaciones recientes</h2>
          {loading ? <p className="text-sm text-slate-500">Cargando…</p> : null}
          {!loading && snapshots.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay importaciones.</p>
          ) : null}
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {snapshots.map((sn) => (
              <li key={sn.id} className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void onPickDetail(sn.id)}
                  className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-left transition ${
                    detail?.id === sn.id
                      ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                  }`}
                >
                  <span className="font-medium text-slate-900 dark:text-white">{sn.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {sn.orderRef ?? "—"} · {new Date(sn.createdAt).toLocaleString()} ·{" "}
                    {sn.project ? `${sn.project.code}` : "sin proyecto"}
                  </span>
                </button>
                {canWrite ? (
                  <button
                    type="button"
                    title="Eliminar importación"
                    disabled={deletingSnapshotId === sn.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDeleteSnapshot(sn.id);
                    }}
                    className="shrink-0 self-stretch rounded-lg border border-red-200 px-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    {deletingSnapshotId === sn.id ? "…" : "✕"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {detail ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          {paymentAlerts.length ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-semibold">Alertas de pago / estado (texto «Pendiente»)</p>
              <ul className="mt-1 list-inside list-disc text-xs leading-relaxed">
                {paymentAlerts.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["resumen", "Resumen"],
                  ["trazabilidad", "Trazabilidad"],
                  ["finanzas", `Finanzas / embarques (${detail.shipments.length})`],
                  ["pallets", `Pallets (${detail.pallets.length})`],
                  ["paneles", `Paneles (${detail.panels.length})`],
                  ["embarques", `Embarques (solo lectura)`],
                  ["transporte", `Transporte (${detail.groundTransport.length})`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    tab === k
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void onExport()}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {exporting ? "Exportando…" : "Exportar Excel"}
            </button>
          </div>

          {tab === "resumen" && s ? (
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {s.headline ? <p>{s.headline}</p> : null}
              {s.productLine ? <p>{s.productLine}</p> : null}
              {s.routeText ? <p>{s.routeText}</p> : null}
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Paneles (archivo)</dt>
                  <dd className="font-semibold">{detail.panels.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Pallets</dt>
                  <dd className="font-semibold">{detail.pallets.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Orden / PI</dt>
                  <dd className="font-semibold">{s.orderRef ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Archivo origen</dt>
                  <dd>{detail.sourceFileName ?? "—"}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {tab === "trazabilidad" && !detail.derived ? (
            <p className="text-sm text-slate-500">
              Actualice el servidor API y vuelva a abrir esta importación para ver la trazabilidad cruzada.
            </p>
          ) : null}

          {tab === "trazabilidad" && detail.derived ? (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Vista cruzada por <strong className="font-normal">ID de pallet</strong>: paneles contados en Base Paneles,
                fechas y potencias en Base Pallets, conductor y patentes en Registro Transporte. «Completa (calc)» exige
                fechas China/Chile/desconsolidación/Coyhaique salida y llegada más transportista, conductor y patente
                camión en el registro de transporte.
              </p>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                  <dt className="text-xs text-slate-500">Filas pallet / panel / transporte</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">
                    {detail.derived.stats.palletRows} / {detail.derived.stats.panelRows} / {detail.derived.stats.transportRows}
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                  <dt className="text-xs text-slate-500">Paneles vinculados a pallet</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">{detail.derived.stats.panelsLinkedToPallet}</dd>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                  <dt className="text-xs text-slate-500">Trazabilidad completa (Excel / calculada)</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">
                    {detail.derived.stats.palletsCompleteBySheet} / {detail.derived.stats.palletsCompleteByCalc} pallets
                  </dd>
                </div>
              </dl>
              <div className="max-h-[min(72vh,640px)] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="px-2 py-1.5 font-semibold">Pallet</th>
                      <th className="px-2 py-1.5 font-semibold">Contenedor</th>
                      <th className="px-2 py-1.5 font-semibold">Estado</th>
                      <th className="px-2 py-1.5 font-semibold">Paneles</th>
                      <th className="px-2 py-1.5 font-semibold">China → Chile</th>
                      <th className="px-2 py-1.5 font-semibold">Coyhaique</th>
                      <th className="px-2 py-1.5 font-semibold">Transporte</th>
                      <th className="px-2 py-1.5 font-semibold">Completa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.derived.pallets.map((row) => (
                      <tr key={row.palletId} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="max-w-[140px] whitespace-normal break-all px-2 py-1 font-mono text-[10px]">{row.palletId}</td>
                        <td className="px-2 py-1">{row.container ?? "—"}</td>
                        <td className="px-2 py-1">{row.estado ?? "—"}</td>
                        <td className="px-2 py-1 align-top">
                          <span className="font-semibold">{row.panelCount || row.cantidadPaneles || "0"}</span>
                          {row.sampleSerials.length ? (
                            <span className="mt-0.5 block text-[10px] text-slate-500">{row.sampleSerials.join(", ")}…</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1 align-top text-[10px] leading-snug">
                          {row.fechaSalidaChina ?? "—"}
                          <br />
                          {row.fechaLlegadaChile ?? "—"}
                          <br />
                          <span className="text-slate-500">Descons.: {row.fechaDesconsolidacion ?? "—"}</span>
                        </td>
                        <td className="px-2 py-1 align-top text-[10px] leading-snug">
                          Salida: {row.fechaSalidaCoyhaique ?? "—"}
                          <br />
                          Llegada: {row.fechaLlegadaCoyhaique ?? "—"}
                          {row.diasEnRuta ? (
                            <>
                              <br />
                              <span className="text-slate-500">Días ruta: {row.diasEnRuta}</span>
                            </>
                          ) : null}
                        </td>
                        <td className="px-2 py-1 align-top text-[10px] leading-snug">
                          {row.transportista ?? "—"}
                          <br />
                          {row.conductor ?? "—"}
                          <br />
                          <span className="text-slate-500">
                            {row.patenteCamion ?? "—"} / {row.patenteRampla ?? "—"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top text-[10px]">
                          <span className={row.trazabilidadCompletaCalc ? "text-emerald-700 dark:text-emerald-400" : ""}>
                            Calc: {row.trazabilidadCompletaCalc ? "Sí" : "No"}
                          </span>
                          <br />
                          <span className="text-slate-500">Excel: {row.trazabilidadExcel ?? "—"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "finanzas" ? (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Edite montos, fechas y estados por embarque (columnas detectadas del Excel «Datos Base»). Pulse guardar para persistir; use Exportar Excel para descargar el libro reconstruido.
              </p>
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingShipments}
                    onClick={() => void onSaveShipments()}
                    className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {savingShipments ? "Guardando…" : "Guardar cambios de embarques"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Solo lectura (su rol no permite guardar).</p>
              )}
              {!draftShipments.length ? (
                <p className="text-sm text-slate-500">No hay filas de embarque.</p>
              ) : (
                <div className="max-h-[min(70vh,560px)] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-left text-[11px]">
                    <thead className="sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">#</th>
                        {financeKeys.map((k) => (
                          <th key={k} className="min-w-[120px] px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-200">
                            {k.length > 40 ? `${k.slice(0, 38)}…` : k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draftShipments.map((row, ri) => (
                        <tr key={ri} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-2 py-1 align-top text-slate-500">{ri + 1}</td>
                          {financeKeys.map((k) => (
                            <td key={k} className="px-1 py-0.5 align-top">
                              <input
                                value={row[k] == null ? "" : String(row[k])}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDraftShipments((prev) => {
                                    const next = prev.map((r) => ({ ...r }));
                                    next[ri] = { ...next[ri], [k]: v };
                                    return next;
                                  });
                                }}
                                className="w-full min-w-[100px] rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] dark:border-slate-600 dark:bg-slate-950"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {tab === "pallets" ? (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Edite fechas, estado, potencias y trazabilidad por pallet; guarde para persistir (exporte Excel para respaldo).
              </p>
              {canWrite ? (
                <button
                  type="button"
                  disabled={savingPallets}
                  onClick={() => void onSavePallets()}
                  className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {savingPallets ? "Guardando…" : "Guardar pallets"}
                </button>
              ) : (
                <p className="text-xs text-slate-500">Solo lectura.</p>
              )}
              {!draftPallets.length ? (
                <p className="text-sm text-slate-500">No hay filas de pallet.</p>
              ) : (
                <div className="max-h-[min(70vh,560px)] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-left text-[11px]">
                    <thead className="sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">#</th>
                        {palletEditKeys.map((k) => (
                          <th key={k} className="min-w-[100px] px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-200">
                            {k.length > 36 ? `${k.slice(0, 34)}…` : k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draftPallets.map((row, ri) => (
                        <tr key={ri} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-2 py-1 align-top text-slate-500">{ri + 1}</td>
                          {palletEditKeys.map((k) => (
                            <td key={k} className="px-1 py-0.5 align-top">
                              <input
                                value={row[k] == null ? "" : String(row[k])}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDraftPallets((prev) => {
                                    const next = prev.map((r) => ({ ...r }));
                                    next[ri] = { ...next[ri], [k]: v };
                                    return next;
                                  });
                                }}
                                disabled={!canWrite}
                                className="w-full min-w-[88px] rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] disabled:opacity-70 dark:border-slate-600 dark:bg-slate-950"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
          {tab === "paneles" ? <TablePreview rows={detail.panels} maxRows={100} keys={panelKeys} /> : null}
          {tab === "embarques" ? <TablePreview rows={detail.shipments} maxRows={40} keys={shipKeys} /> : null}
          {tab === "transporte" ? (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Registro terrestre (tramo Coyhaique u otro): conductor, RUT, patentes y fechas de despacho. Guarde antes de
                exportar si editó aquí.
              </p>
              {canWrite ? (
                <button
                  type="button"
                  disabled={savingTransport}
                  onClick={() => void onSaveTransport()}
                  className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {savingTransport ? "Guardando…" : "Guardar transporte"}
                </button>
              ) : (
                <p className="text-xs text-slate-500">Solo lectura.</p>
              )}
              {!draftTransport.length ? (
                <p className="text-sm text-slate-500">No hay filas de transporte.</p>
              ) : (
                <div className="max-h-[min(70vh,560px)] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-left text-[11px]">
                    <thead className="sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">#</th>
                        {transportEditKeys.map((k) => (
                          <th key={k} className="min-w-[100px] px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-200">
                            {k.length > 36 ? `${k.slice(0, 34)}…` : k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draftTransport.map((row, ri) => (
                        <tr key={ri} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-2 py-1 align-top text-slate-500">{ri + 1}</td>
                          {transportEditKeys.map((k) => (
                            <td key={k} className="px-1 py-0.5 align-top">
                              <input
                                value={row[k] == null ? "" : String(row[k])}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDraftTransport((prev) => {
                                    const next = prev.map((r) => ({ ...r }));
                                    next[ri] = { ...next[ri], [k]: v };
                                    return next;
                                  });
                                }}
                                disabled={!canWrite}
                                className="w-full min-w-[88px] rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px] disabled:opacity-70 dark:border-slate-600 dark:bg-slate-950"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default function OperacionInternacionalPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600 dark:text-slate-400">Cargando…</p>}>
      <OperacionInternacionalInner />
    </Suspense>
  );
}
