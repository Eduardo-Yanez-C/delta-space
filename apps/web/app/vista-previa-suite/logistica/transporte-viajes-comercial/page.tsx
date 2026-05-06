"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../lib/auth-context";
import {
  closeTransportTrip,
  createTransportTrip,
  expectedTransportGroupKey,
  fetchSuiteProjects,
  fetchTransportTrip,
  fetchTransportTrips,
  recalculateTransportTrip,
  updateTransportTrip,
  type SuiteProjectRow,
  type TransportTripCommercialDetail,
  type TransportTripCommercialListRow,
} from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";

const TRANSPORTE = "/vista-previa-suite/logistica/transporte";
const COMERCIAL = "/vista-previa-suite/logistica/transporte-comercial";
const VARIABLES = "/vista-previa-suite/logistica/transporte-variables";

function money(n: number | null | undefined, c: string): string {
  const cur = (c || "CLP").trim() || "CLP";
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: cur === "USD" || cur === "EUR" || cur === "CLP" ? cur : "CLP",
      maximumFractionDigits: cur === "CLP" ? 0 : 2,
    }).format(n);
  } catch {
    return `${n.toLocaleString("es-CL")} ${cur}`;
  }
}

function TransporteViajesComercialInner() {
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
  const [filterProjectId, setFilterProjectId] = useState("");
  const [rows, setRows] = useState<TransportTripCommercialListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransportTripCommercialDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [nfProjectId, setNfProjectId] = useState("");
  const [nfPalletId, setNfPalletId] = useState("");
  const [nfTripNumber, setNfTripNumber] = useState("");
  const [nfScenario, setNfScenario] = useState("COMMERCIAL");
  const [formErr, setFormErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [list, p] = await Promise.all([
        fetchTransportTrips({
          projectId: filterProjectId.trim() || null,
          status: null,
        }),
        fetchSuiteProjects(),
      ]);
      setRows(list);
      setProjects(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterProjectId]);

  useEffect(() => {
    if (!canSee) return;
    void reload();
  }, [canSee, reload]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailErr(null);
    try {
      setDetail(await fetchTransportTrip(id));
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : "Error");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const expectedKeyPreview = useMemo(() => {
    if (!nfProjectId.trim()) return "";
    return expectedTransportGroupKey(nfProjectId.trim(), nfPalletId.trim() || null);
  }, [nfProjectId, nfPalletId]);

  const onCreate = async () => {
    if (!canWrite) return;
    setSaving(true);
    setFormErr(null);
    try {
      if (!nfProjectId.trim()) throw new Error("Seleccione proyecto.");
      if (!nfTripNumber.trim()) throw new Error("Indique número de viaje.");
      const gk = expectedTransportGroupKey(nfProjectId.trim(), nfPalletId.trim() || null);
      await createTransportTrip({
        projectId: nfProjectId.trim(),
        groupKey: gk,
        palletId: nfPalletId.trim() || null,
        tripNumber: nfTripNumber.trim(),
        scenario: nfScenario,
      });
      setCreateOpen(false);
      setNfPalletId("");
      setNfTripNumber("");
      await reload();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const recalc = async () => {
    if (!canWrite || !detail) return;
    setSaving(true);
    setDetailErr(null);
    try {
      setDetail(await recalculateTransportTrip(detail.id));
      await reload();
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const closeTrip = async () => {
    if (!canWrite || !detail) return;
    if (!window.confirm("¿Cerrar viaje? Quedará inmutable (no se podrá editar ni recalcular).")) return;
    setSaving(true);
    setDetailErr(null);
    try {
      setDetail(await closeTransportTrip(detail.id));
      await reload();
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const saveOpFields = async () => {
    if (!canWrite || !detail || detail.status !== "DRAFT") return;
    setSaving(true);
    setDetailErr(null);
    try {
      setDetail(
        await updateTransportTrip(detail.id, {
          kmUsed: detail.kmUsed,
          litersUsed: detail.litersUsed,
          notes: detail.notes,
          extraChargesNote: detail.extraChargesNote,
        }),
      );
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <p className="p-6 text-sm text-slate-600">Cargando…</p>;
  if (!user)
    return (
      <p className="p-6 text-sm">
        <Link href="/login" className="text-amber-600 underline">
          Inicie sesión
        </Link>
      </p>
    );
  if (!canSee)
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        No tiene permiso para ver Logística.
      </div>
    );

  return (
    <div className="mx-auto max-w-[92rem] space-y-4 px-3 py-3 md:px-4">
      <header className="space-y-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logística · Fase 3–4</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Viajes comerciales (ledger)</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Unidad de verdad comercial por <strong className="font-medium">groupKey + nº viaje</strong>. Recalcular
              borrador aplica tarifario / overrides del acuerdo vigente,{" "}
              <strong className="font-medium">variables de transporte</strong> (perfil contrato → proyecto) y unidades{" "}
              <span className="font-mono text-[11px]">KM</span> /{" "}
              <span className="font-mono text-[11px]">LITER</span>; cerrar congela líneas y totales.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={TRANSPORTE} className="text-primary-600 underline dark:text-primary-400">
              Transporte
            </Link>
            <Link href={COMERCIAL} className="text-primary-600 underline dark:text-primary-400">
              Acuerdos por grupo
            </Link>
            <Link href={VARIABLES} className="text-primary-600 underline dark:text-primary-400">
              Variables transporte
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Proyecto
            <select
              className="mt-1 block min-w-[200px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
            >
              <option value="">Todos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </label>
          {canWrite ? (
            <button
              type="button"
              onClick={() => {
                setCreateOpen(true);
                setFormErr(null);
                if (!nfProjectId && filterProjectId) setNfProjectId(filterProjectId);
              }}
              className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Nuevo viaje
            </button>
          ) : null}
        </div>
      </header>

      {err ? <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">{err}</p> : null}

      {createOpen ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Alta de viaje (borrador)</h2>
          {formErr ? <p className="mt-2 text-sm text-red-700">{formErr}</p> : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Proyecto *
              <select
                className="select-field-sm mt-0.5 w-full"
                value={nfProjectId}
                onChange={(e) => setNfProjectId(e.target.value)}
              >
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Pallet ID (opcional; vacío = _sin_pallet)
              <input
                className="input-field-sm mt-0.5 w-full font-mono text-xs"
                value={nfPalletId}
                onChange={(e) => setNfPalletId(e.target.value)}
                placeholder="mismo id que en inventario"
              />
            </label>
            <p className="sm:col-span-2 text-[11px] text-slate-500">
              groupKey generado: <span className="font-mono text-slate-800 dark:text-slate-200">{expectedKeyPreview || "—"}</span>
            </p>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Nº viaje *
              <input
                className="input-field-sm mt-0.5 w-full"
                value={nfTripNumber}
                onChange={(e) => setNfTripNumber(e.target.value)}
                placeholder="ej. 12"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Escenario
              <select className="select-field-sm mt-0.5 w-full" value={nfScenario} onChange={(e) => setNfScenario(e.target.value)}>
                <option value="COMMERCIAL">COMMERCIAL</option>
                <option value="SUBSIDIZED">SUBSIDIZED</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded bg-primary-600 px-4 py-1 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void onCreate()}
            >
              Crear
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-xs font-bold uppercase text-slate-500">Viajes</h2>
          {loading ? <p className="mt-2 text-sm text-slate-500">Cargando…</p> : null}
          {!loading && rows.length === 0 ? <p className="mt-2 text-sm text-slate-500">Sin registros.</p> : null}
          <ul className="mt-2 max-h-[min(70vh,520px)] space-y-1 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedId === r.id
                      ? "border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/40"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/80"
                  }`}
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Viaje {r.tripNumber} · {r.status}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{r.groupKey}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-600">
                    {r.total != null ? money(r.total, r.currency) : "Sin total"}
                    {" · "}
                    {r._count.lines} líneas
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          {!selectedId ? (
            <p className="text-sm text-slate-500">Seleccione un viaje.</p>
          ) : detailLoading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : detailErr ? (
            <p className="text-sm text-red-700">{detailErr}</p>
          ) : detail ? (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Viaje {detail.tripNumber}{" "}
                    <span
                      className={
                        detail.status === "CLOSED" ? "text-slate-500" : "text-amber-600"
                      }
                    >
                      ({detail.status})
                    </span>
                  </h2>
                  <p className="font-mono text-xs text-slate-500">{detail.groupKey}</p>
                  <p className="text-xs text-slate-500">
                    Fecha viaje: {new Date(detail.tripDate).toLocaleString("es-CL")} · {detail.scenario}
                  </p>
                </div>
                {canWrite && detail.status === "DRAFT" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      className="rounded-md bg-slate-700 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-300 dark:text-slate-900"
                      onClick={() => void recalc()}
                    >
                      Recalcular
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white"
                      onClick={() => void closeTrip()}
                    >
                      Cerrar viaje
                    </button>
                  </div>
                ) : null}
              </div>

              {detail.status === "DRAFT" && canWrite ? (
                <div className="space-y-2 rounded border border-slate-100 p-2 text-xs dark:border-slate-800">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label>
                      km
                      <input
                        type="number"
                        className="input-field-sm mt-0.5 w-full"
                        value={detail.kmUsed ?? ""}
                        onChange={(e) =>
                          setDetail((d) =>
                            d ? { ...d, kmUsed: e.target.value === "" ? null : parseFloat(e.target.value) } : d,
                          )
                        }
                      />
                    </label>
                    <label>
                      litros
                      <input
                        type="number"
                        className="input-field-sm mt-0.5 w-full"
                        value={detail.litersUsed ?? ""}
                        onChange={(e) =>
                          setDetail((d) =>
                            d ? { ...d, litersUsed: e.target.value === "" ? null : parseFloat(e.target.value) } : d,
                          )
                        }
                      />
                    </label>
                    <label className="sm:col-span-2">
                      Notas operativas
                      <textarea
                        className="input-field-sm mt-0.5 min-h-[48px] w-full"
                        value={detail.notes ?? ""}
                        onChange={(e) => setDetail((d) => (d ? { ...d, notes: e.target.value || null } : d))}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold dark:border-slate-600"
                    onClick={() => void saveOpFields()}
                  >
                    Guardar datos operativos
                  </button>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-4 text-xs">
                <span>
                  Subtotal: <strong>{money(detail.subtotal, detail.currency)}</strong>
                </span>
                <span>
                  IVA: <strong>{money(detail.vatAmount, detail.currency)}</strong>
                </span>
                <span>
                  Total: <strong>{money(detail.total, detail.currency)}</strong>
                </span>
              </div>

              {detail.contractVersion ? (
                <p className="text-[11px] text-slate-500">
                  Versión contrato ref.: v{detail.contractVersion.versionNumber} · {detail.contractVersion.contract.title}
                </p>
              ) : null}

              <div className="rounded border border-slate-100 p-2 text-xs dark:border-slate-800">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Variables a la fecha del viaje</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Perfil usado en resolución:{" "}
                  <span className="font-mono">
                    {detail.inputsResolvedAtProfileId ?? "—"}
                  </span>{" "}
                  (contrato publicado del acuerdo, si existe; si no, perfil del proyecto; valores globales como
                  respaldo).
                </p>
                <div className="mt-2 max-h-40 overflow-y-auto">
                  <table className="min-w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                        <th className="py-1 pr-2">Clave</th>
                        <th className="py-1 pr-2">Etiqueta</th>
                        <th className="py-1 pr-2">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.inputsResolved ?? []).map((row) => (
                        <tr key={row.variableId} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1 pr-2 font-mono text-[10px]">{row.key}</td>
                          <td className="py-1 pr-2">{row.label}</td>
                          <td className="py-1 pr-2 font-mono">
                            {row.resolved != null
                              ? `${row.resolved.value}${row.resolved.unit ? ` ${row.resolved.unit}` : ""}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                      <th className="py-1 pr-2">Concepto</th>
                      <th className="py-1 pr-2">Origen</th>
                      <th className="py-1 pr-2">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((ln) => (
                      <tr key={ln.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1 pr-2">
                          <span>{ln.concept}</span>
                          {ln.notes ? (
                            <span className="mt-0.5 block text-[10px] text-slate-500">{ln.notes}</span>
                          ) : null}
                        </td>
                        <td className="py-1 pr-2 font-mono text-[10px] text-slate-500">{ln.sourceKind}</td>
                        <td className="py-1 pr-2 font-mono">{money(ln.amount, ln.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default function TransporteViajesComercialPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Cargando…</p>}>
      <TransporteViajesComercialInner />
    </Suspense>
  );
}
