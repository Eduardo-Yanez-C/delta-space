"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../../../lib/auth-context";
import {
  createTransportContract,
  createTransportContractVersion,
  createTransportTariffItem,
  createTransportTariffOverride,
  deleteTransportTariffItem,
  deleteTransportTariffOverride,
  fetchSuiteProjects,
  fetchSuppliers,
  fetchTransportContract,
  fetchTransportContracts,
  fetchTransportVariableProfiles,
  publishTransportContractVersion,
  updateTransportContract,
  updateTransportTariffItem,
  type SuiteProjectRow,
  type Supplier,
  type TransportContractDetail,
  type TransportContractListRow,
  type TransportTariffItem,
  type TransportTariffOverrideRow,
  type TransportVariableProfileRow,
} from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";

const TRANSPORTE = "/vista-previa-suite/logistica/transporte";
const TRANSPORTE_COMERCIAL = "/vista-previa-suite/logistica/transporte-comercial";
const TRANSPORTE_VARIABLES = "/vista-previa-suite/logistica/transporte-variables";

const UNIT_OPTIONS = [
  "TRIP",
  "CONTAINER",
  "DAY",
  "HOUR",
  "KM",
  "LITER",
  "FIXED",
  "UF_PER_TON_MONTH",
  "PCT",
  "OTHER",
] as const;

const TAX_OPTIONS = ["NONE", "VAT_EXTRA", "VAT_INCLUDED"] as const;

const OVERRIDE_ACTIONS = ["ADDITION", "REPLACE_BASE", "SUPPRESS_BASE"] as const;

function isoSlice16(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

function money(n: number, c: string): string {
  const cur = (c || "CLP").trim() || "CLP";
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

function LogisticaTransporteContratosInner() {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId")?.trim() ?? "";
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterProjectId, setFilterProjectId] = useState(urlProjectId);
  const [filterSupplierId, setFilterSupplierId] = useState("");
  const [rows, setRows] = useState<TransportContractListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransportContractDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [nfTitle, setNfTitle] = useState("");
  const [nfSupplierId, setNfSupplierId] = useState("");
  const [nfProjectId, setNfProjectId] = useState("");
  const [nfClient, setNfClient] = useState("");
  const [nfContractor, setNfContractor] = useState("");
  const [nfNumber, setNfNumber] = useState("");

  const [itemLabel, setItemLabel] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemUnit, setItemUnit] = useState<string>("TRIP");
  const [itemAmount, setItemAmount] = useState("");
  const [itemTax, setItemTax] = useState<string>("VAT_EXTRA");
  const [itemLegal, setItemLegal] = useState("");
  const [itemActiveFrom, setItemActiveFrom] = useState("");
  const [itemActiveTo, setItemActiveTo] = useState("");
  const [itemRowVig, setItemRowVig] = useState<Record<string, { from: string; to: string }>>({});
  const [variableProfiles, setVariableProfiles] = useState<TransportVariableProfileRow[]>([]);

  const [ovAction, setOvAction] = useState<string>("ADDITION");
  const [ovLabel, setOvLabel] = useState("");
  const [ovAmount, setOvAmount] = useState("");
  const [ovReason, setOvReason] = useState("");
  const [ovDoc, setOvDoc] = useState("");
  const [ovBaseItemId, setOvBaseItemId] = useState("");
  const [ovValidFrom, setOvValidFrom] = useState(() => new Date().toISOString().slice(0, 16));
  const [ovValidTo, setOvValidTo] = useState("");
  const [ovUnit, setOvUnit] = useState<string>("FIXED");
  const [ovTax, setOvTax] = useState<string>("VAT_EXTRA");

  const reloadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, p, s] = await Promise.all([
        fetchTransportContracts({
          projectId: filterProjectId.trim() || null,
          supplierId: filterSupplierId.trim() || null,
          activeOnly: true,
        }),
        fetchSuiteProjects(),
        fetchSuppliers({ actorType: "TRANSPORTISTA", active: true }),
      ]);
      setRows(list);
      setProjects(p);
      setSuppliers(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterProjectId, filterSupplierId]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  useEffect(() => {
    if (!canSee) return;
    void (async () => {
      try {
        setVariableProfiles(await fetchTransportVariableProfiles());
      } catch {
        setVariableProfiles([]);
      }
    })();
  }, [canSee]);

  useEffect(() => {
    if (urlProjectId && !filterProjectId) setFilterProjectId(urlProjectId);
  }, [urlProjectId, filterProjectId]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await fetchTransportContract(id);
      setDetail(d);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Error al cargar contrato");
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

  useEffect(() => {
    if (!detail) {
      setItemRowVig({});
      return;
    }
    const m: Record<string, { from: string; to: string }> = {};
    for (const v of detail.versions) {
      for (const it of v.items) {
        m[it.id] = {
          from: isoSlice16(it.activeFrom),
          to: isoSlice16(it.activeTo),
        };
      }
    }
    setItemRowVig(m);
  }, [detail]);

  const onCreate = async () => {
    if (!canWrite) return;
    setSaving(true);
    setFormErr(null);
    try {
      if (!nfTitle.trim()) throw new Error("Indique el título del contrato.");
      if (!nfSupplierId.trim()) throw new Error("Seleccione transportista.");
      const d = await createTransportContract({
        supplierId: nfSupplierId.trim(),
        projectId: nfProjectId.trim() || null,
        title: nfTitle.trim(),
        contractNumber: nfNumber.trim() || null,
        clientLegalName: nfClient.trim() || null,
        contractorLegalName: nfContractor.trim() || null,
      });
      setCreateOpen(false);
      setNfTitle("");
      setNfSupplierId("");
      setNfProjectId("");
      setNfClient("");
      setNfContractor("");
      setNfNumber("");
      await reloadList();
      setSelectedId(d.id);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const saveHeader = async () => {
    if (!canWrite || !detail) return;
    setSaving(true);
    setDetailError(null);
    try {
      const d = await updateTransportContract(detail.id, {
        title: detail.title,
        contractNumber: detail.contractNumber,
        clientLegalName: detail.clientLegalName,
        contractorLegalName: detail.contractorLegalName,
        paymentTerms: detail.paymentTerms,
        jurisdiction: detail.jurisdiction,
        defaultCurrency: detail.defaultCurrency,
        defaultVatPercent: detail.defaultVatPercent,
        notes: detail.notes,
        transportVariableProfileId: detail.transportVariableProfileId?.trim() || null,
      });
      setDetail(d);
      await reloadList();
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const primaryDraftVersionId = useMemo(() => {
    if (!detail?.versions.length) return null;
    const drafts = detail.versions.filter((v) => v.status === "DRAFT");
    if (!drafts.length) return null;
    return drafts.sort((a, b) => b.versionNumber - a.versionNumber)[0]?.id ?? null;
  }, [detail]);

  /** Versión con mayor `versionNumber` (fuente estable para «copiar última»). */
  const latestVersionIdForCopy = useMemo(() => {
    if (!detail?.versions.length) return null;
    return [...detail.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]?.id ?? null;
  }, [detail]);

  const addItem = async () => {
    if (!canWrite || !detail || !primaryDraftVersionId) return;
    const amt = parseFloat(itemAmount.replace(",", "."));
    setSaving(true);
    setDetailError(null);
    try {
      if (!itemLabel.trim()) throw new Error("Concepto requerido");
      if (Number.isNaN(amt) || amt < 0) throw new Error("Monto inválido");
      await createTransportTariffItem(detail.id, primaryDraftVersionId, {
        label: itemLabel.trim(),
        code: itemCode.trim() || null,
        unit: itemUnit,
        amount: amt,
        taxMode: itemTax,
        legalRef: itemLegal.trim() || null,
        activeFrom: itemActiveFrom.trim() ? new Date(itemActiveFrom).toISOString() : null,
        activeTo: itemActiveTo.trim() ? new Date(itemActiveTo).toISOString() : null,
      });
      setItemLabel("");
      setItemCode("");
      setItemAmount("");
      setItemLegal("");
      setItemActiveFrom("");
      setItemActiveTo("");
      await loadDetail(detail.id);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Error al agregar ítem");
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (versionId: string, itemId: string) => {
    if (!canWrite || !detail) return;
    if (!window.confirm("¿Eliminar esta línea del tarifario?")) return;
    setSaving(true);
    setDetailError(null);
    try {
      await deleteTransportTariffItem(detail.id, versionId, itemId);
      await loadDetail(detail.id);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const applyItemVigencia = async (versionId: string, itemId: string) => {
    if (!canWrite || !detail) return;
    const row = itemRowVig[itemId] ?? { from: "", to: "" };
    setSaving(true);
    setDetailError(null);
    try {
      await updateTransportTariffItem(detail.id, versionId, itemId, {
        activeFrom: row.from.trim() ? new Date(row.from).toISOString() : null,
        activeTo: row.to.trim() ? new Date(row.to).toISOString() : null,
      });
      await loadDetail(detail.id);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const addOverride = async (versionId: string) => {
    if (!canWrite || !detail) return;
    const n = parseFloat(ovAmount.replace(",", "."));
    setSaving(true);
    setDetailError(null);
    try {
      if (!ovLabel.trim()) throw new Error("Etiqueta de la excepción requerida.");
      if (!ovReason.trim()) throw new Error("Motivo / acta (texto) requerido.");
      if (Number.isNaN(n) || n < 0) throw new Error("Monto inválido.");
      await createTransportTariffOverride(detail.id, versionId, {
        action: ovAction,
        label: ovLabel.trim(),
        amount: n,
        unit: ovUnit,
        taxMode: ovTax,
        currency: detail.defaultCurrency,
        reason: ovReason.trim(),
        documentRef: ovDoc.trim() || null,
        validFrom: new Date(ovValidFrom).toISOString(),
        validTo: ovValidTo.trim() ? new Date(ovValidTo).toISOString() : null,
        baseTariffItemId: ovBaseItemId.trim() || null,
      });
      setOvLabel("");
      setOvAmount("");
      setOvReason("");
      setOvDoc("");
      setOvBaseItemId("");
      setOvValidFrom(new Date().toISOString().slice(0, 16));
      setOvValidTo("");
      await loadDetail(detail.id);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Error al crear excepción");
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (versionId: string, row: TransportTariffOverrideRow) => {
    if (!canWrite || !detail) return;
    if (!window.confirm(`¿Eliminar excepción «${row.label}»?`)) return;
    setSaving(true);
    setDetailError(null);
    try {
      await deleteTransportTariffOverride(detail.id, versionId, row.id);
      await loadDetail(detail.id);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (versionId: string) => {
    if (!canWrite || !detail) return;
    if (!window.confirm("¿Publicar esta versión? Las anteriores publicadas pasan a archivo.")) return;
    setSaving(true);
    setDetailError(null);
    try {
      await publishTransportContractVersion(detail.id, versionId);
      await loadDetail(detail.id);
      await reloadList();
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setSaving(false);
    }
  };

  const newVersion = async (copyFromVersionId?: string | null) => {
    if (!canWrite || !detail) return;
    setSaving(true);
    setDetailError(null);
    try {
      await createTransportContractVersion(detail.id, {
        copyFromVersionId: copyFromVersionId ?? null,
        label: copyFromVersionId ? "Copia para edición" : null,
      });
      await loadDetail(detail.id);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Error");
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
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Logística · Transporte
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Contratos y tarifarios
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Contratos versionados con anexo de ítems (flete, contenedor, días, IVA, referencia legal). Publique una
              versión para usarla en el acuerdo comercial por pallet en{" "}
              <Link href={TRANSPORTE} className="font-medium text-primary-600 underline dark:text-primary-400">
                Transporte
              </Link>
              .
            </p>
          </div>
          {canWrite ? (
            <button
              type="button"
              onClick={() => {
                setCreateOpen(true);
                setFormErr(null);
              }}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
            >
              Nuevo contrato
            </button>
          ) : null}
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
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Transportista
            <select
              className="mt-1 block min-w-[200px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={filterSupplierId}
              onChange={(e) => setFilterSupplierId(e.target.value)}
            >
              <option value="">Todos</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 text-sm">
            <Link href={TRANSPORTE_COMERCIAL} className="text-primary-600 underline dark:text-primary-400">
              Plantillas rápidas
            </Link>
            <Link href={TRANSPORTE_VARIABLES} className="text-primary-600 underline dark:text-primary-400">
              Variables (Inputs)
            </Link>
            <Link href={TRANSPORTE} className="text-primary-600 underline dark:text-primary-400">
              Transporte
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {createOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] bg-slate-900/40"
            aria-label="Cerrar"
            onClick={() => setCreateOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-[85] w-[min(100vw-24px,480px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-950">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Nuevo contrato</h2>
            {formErr ? <p className="mt-2 text-xs text-red-700">{formErr}</p> : null}
            <div className="mt-3 space-y-2 text-xs">
              <label className="block font-semibold text-slate-600 dark:text-slate-300">
                Título
                <input className="input-field-sm mt-0.5 w-full" value={nfTitle} onChange={(e) => setNfTitle(e.target.value)} />
              </label>
              <label className="block font-semibold text-slate-600 dark:text-slate-300">
                Transportista
                <select
                  className="select-field-sm mt-0.5 w-full"
                  value={nfSupplierId}
                  onChange={(e) => setNfSupplierId(e.target.value)}
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block font-semibold text-slate-600 dark:text-slate-300">
                Proyecto (opcional)
                <select
                  className="select-field-sm mt-0.5 w-full"
                  value={nfProjectId}
                  onChange={(e) => setNfProjectId(e.target.value)}
                >
                  <option value="">— Cualquier proyecto —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block font-semibold text-slate-600 dark:text-slate-300">
                Nº contrato
                <input className="input-field-sm mt-0.5 w-full" value={nfNumber} onChange={(e) => setNfNumber(e.target.value)} />
              </label>
              <label className="block font-semibold text-slate-600 dark:text-slate-300">
                Contratante (texto)
                <input className="input-field-sm mt-0.5 w-full" value={nfClient} onChange={(e) => setNfClient(e.target.value)} />
              </label>
              <label className="block font-semibold text-slate-600 dark:text-slate-300">
                Contratista (texto)
                <input
                  className="input-field-sm mt-0.5 w-full"
                  value={nfContractor}
                  onChange={(e) => setNfContractor(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setCreateOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void onCreate()}
              >
                Crear
              </button>
            </div>
          </div>
        </>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Contratos</h2>
          {loading ? <p className="mt-2 text-sm text-slate-500">Cargando…</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Sin contratos en este filtro.</p>
          ) : null}
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
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{r.title}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {r.supplier.name}
                    {r.project ? ` · ${r.project.code}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          {!selectedId ? (
            <p className="text-sm text-slate-500">Seleccione un contrato.</p>
          ) : detailLoading ? (
            <p className="text-sm text-slate-500">Cargando ficha…</p>
          ) : detailError ? (
            <p className="text-sm text-red-700">{detailError}</p>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{detail.title}</h2>
                {canWrite ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveHeader()}
                    className="rounded-md bg-slate-800 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-200 dark:text-slate-900"
                  >
                    Guardar cabecera
                  </button>
                ) : null}
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                {(
                  [
                    ["contractNumber", "Nº contrato"],
                    ["clientLegalName", "Contratante"],
                    ["contractorLegalName", "Contratista"],
                    ["paymentTerms", "Condiciones de pago"],
                    ["jurisdiction", "Jurisdicción"],
                  ] as const
                ).map(([key, lab]) => (
                  <label key={key} className="block font-medium text-slate-600 dark:text-slate-300">
                    {lab}
                    <input
                      className="input-field-sm mt-0.5 w-full"
                      value={(detail[key] as string | null) ?? ""}
                      onChange={(e) =>
                        setDetail((d) =>
                          d ? { ...d, [key]: e.target.value || null } : d,
                        )
                      }
                    />
                  </label>
                ))}
                <label className="block font-medium text-slate-600 dark:text-slate-300">
                  Moneda por defecto
                  <select
                    className="select-field-sm mt-0.5 w-full"
                    value={detail.defaultCurrency}
                    onChange={(e) => setDetail((d) => (d ? { ...d, defaultCurrency: e.target.value } : d))}
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
                <label className="block font-medium text-slate-600 dark:text-slate-300">
                  IVA % por defecto
                  <input
                    type="number"
                    className="input-field-sm mt-0.5 w-full"
                    value={detail.defaultVatPercent}
                    onChange={(e) =>
                      setDetail((d) =>
                        d ? { ...d, defaultVatPercent: parseFloat(e.target.value) || 0 } : d,
                      )
                    }
                  />
                </label>
                <label className="sm:col-span-2 block font-medium text-slate-600 dark:text-slate-300">
                  Perfil de variables (mercado / Inputs)
                  <select
                    className="select-field-sm mt-0.5 w-full"
                    value={detail.transportVariableProfileId ?? ""}
                    onChange={(e) => {
                      const vid = e.target.value.trim() || null;
                      setDetail((d) => {
                        if (!d) return d;
                        const pr = vid ? variableProfiles.find((p) => p.id === vid) : null;
                        return {
                          ...d,
                          transportVariableProfileId: vid,
                          transportVariableProfile: pr ? { id: pr.id, name: pr.name } : null,
                        };
                      });
                    }}
                  >
                    <option value="">— Sin perfil (solo valores globales) —</option>
                    {variableProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                    Gestione perfiles y series en{" "}
                    <Link href={TRANSPORTE_VARIABLES} className="text-primary-600 underline dark:text-primary-400">
                      Variables (Inputs)
                    </Link>
                    .
                  </span>
                </label>
                <label className="sm:col-span-2 block font-medium text-slate-600 dark:text-slate-300">
                  Notas
                  <textarea
                    className="input-field-sm mt-0.5 min-h-[56px] w-full"
                    value={detail.notes ?? ""}
                    onChange={(e) => setDetail((d) => (d ? { ...d, notes: e.target.value || null } : d))}
                  />
                </label>
              </div>

              <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Versiones</h3>
                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold dark:border-slate-600"
                        onClick={() => void newVersion(null)}
                      >
                        + Versión vacía
                      </button>
                      {latestVersionIdForCopy ? (
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold dark:border-slate-600"
                          onClick={() => void newVersion(latestVersionIdForCopy)}
                        >
                          + Copiar última
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <ul className="mt-2 space-y-2">
                  {[...detail.versions].sort((a, b) => a.versionNumber - b.versionNumber).map((v) => (
                    <li
                      key={v.id}
                      className="rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          v{v.versionNumber}{" "}
                          <span
                            className={
                              v.status === "PUBLISHED"
                                ? "text-emerald-600"
                                : v.status === "DRAFT"
                                  ? "text-amber-600"
                                  : "text-slate-500"
                            }
                          >
                            {v.status}
                          </span>
                        </span>
                        {canWrite && v.status === "DRAFT" ? (
                          <button
                            type="button"
                            disabled={saving}
                            className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white"
                            onClick={() => void publish(v.id)}
                          >
                            Publicar
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {v.items.length} ítem{v.items.length === 1 ? "" : "s"} · {(v.overrides ?? []).length} excepción
                        {(v.overrides ?? []).length === 1 ? "" : "es"}
                      </p>
                      {v.status === "DRAFT" && canWrite && primaryDraftVersionId === v.id ? (
                        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                          <p className="font-semibold text-slate-700 dark:text-slate-200">Tarifario (borrador)</p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-[11px]">
                              <thead>
                                <tr className="text-left text-slate-500">
                                  <th className="py-1 pr-2">Concepto</th>
                                  <th className="py-1 pr-2">Unidad</th>
                                  <th className="py-1 pr-2">Monto</th>
                                  <th className="py-1 pr-2">IVA</th>
                                  <th className="py-1 pr-2 min-w-[200px]">Vigencia línea</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {v.items.map((it: TransportTariffItem) => (
                                  <tr key={it.id} className="border-t border-slate-100 dark:border-slate-800">
                                    <td className="py-1 pr-2">
                                      <span className="font-medium text-slate-800 dark:text-slate-100">{it.label}</span>
                                      {it.legalRef ? (
                                        <span className="mt-0.5 block text-[10px] text-slate-500">{it.legalRef}</span>
                                      ) : null}
                                    </td>
                                    <td className="py-1 pr-2 font-mono">{it.unit}</td>
                                    <td className="py-1 pr-2 font-mono">{money(it.amount, it.currency)}</td>
                                    <td className="py-1 pr-2">{it.taxMode}</td>
                                    <td className="py-1 pr-2 align-top">
                                      <div className="flex flex-col gap-0.5">
                                        <input
                                          type="datetime-local"
                                          className="w-full min-w-[140px] rounded border border-slate-200 px-1 py-0.5 text-[10px] dark:border-slate-600 dark:bg-slate-950"
                                          value={itemRowVig[it.id]?.from ?? ""}
                                          onChange={(e) =>
                                            setItemRowVig((m) => ({
                                              ...m,
                                              [it.id]: { ...(m[it.id] ?? { from: "", to: "" }), from: e.target.value },
                                            }))
                                          }
                                        />
                                        <input
                                          type="datetime-local"
                                          className="w-full min-w-[140px] rounded border border-slate-200 px-1 py-0.5 text-[10px] dark:border-slate-600 dark:bg-slate-950"
                                          value={itemRowVig[it.id]?.to ?? ""}
                                          onChange={(e) =>
                                            setItemRowVig((m) => ({
                                              ...m,
                                              [it.id]: { ...(m[it.id] ?? { from: "", to: "" }), to: e.target.value },
                                            }))
                                          }
                                        />
                                        <button
                                          type="button"
                                          className="text-left text-[10px] font-semibold text-primary-600 underline"
                                          disabled={saving}
                                          onClick={() => void applyItemVigencia(v.id, it.id)}
                                        >
                                          Guardar vigencia
                                        </button>
                                      </div>
                                    </td>
                                    <td className="py-1">
                                      <button
                                        type="button"
                                        className="text-red-600 underline"
                                        onClick={() => void removeItem(v.id, it.id)}
                                      >
                                        Quitar
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="grid gap-1 sm:grid-cols-2">
                            <input
                              className="input-field-sm"
                              placeholder="Código (opcional)"
                              value={itemCode}
                              onChange={(e) => setItemCode(e.target.value)}
                            />
                            <input
                              className="input-field-sm sm:col-span-2"
                              placeholder="Concepto *"
                              value={itemLabel}
                              onChange={(e) => setItemLabel(e.target.value)}
                            />
                            <select className="select-field-sm" value={itemUnit} onChange={(e) => setItemUnit(e.target.value)}>
                              {UNIT_OPTIONS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                            <input
                              className="input-field-sm font-mono"
                              placeholder="Monto *"
                              value={itemAmount}
                              onChange={(e) => setItemAmount(e.target.value)}
                            />
                            <select className="select-field-sm" value={itemTax} onChange={(e) => setItemTax(e.target.value)}>
                              {TAX_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            <input
                              className="input-field-sm sm:col-span-2"
                              placeholder="Ref. legal / cláusula"
                              value={itemLegal}
                              onChange={(e) => setItemLegal(e.target.value)}
                            />
                            <p className="text-[10px] text-slate-500 sm:col-span-2">
                              <strong>Fase 4:</strong> unidad <span className="font-mono">KM</span> o{" "}
                              <span className="font-mono">LITER</span> multiplica el monto por km o litros del viaje. Si el{" "}
                              <span className="font-mono">código</span> coincide con una variable activa (misma clave),
                              el monto del ítem se toma del valor resuelto a la fecha del viaje.
                            </p>
                            <label className="text-[10px] text-slate-500 sm:col-span-2">
                              Vigencia de la línea (opcional)
                              <div className="mt-0.5 flex flex-wrap gap-2">
                                <input
                                  type="datetime-local"
                                  className="input-field-sm flex-1 min-w-[140px]"
                                  value={itemActiveFrom}
                                  onChange={(e) => setItemActiveFrom(e.target.value)}
                                />
                                <input
                                  type="datetime-local"
                                  className="input-field-sm flex-1 min-w-[140px]"
                                  value={itemActiveTo}
                                  onChange={(e) => setItemActiveTo(e.target.value)}
                                />
                              </div>
                            </label>
                            <button
                              type="button"
                              disabled={saving}
                              className="rounded bg-primary-600 px-3 py-1 text-[11px] font-semibold text-white sm:col-span-2"
                              onClick={() => void addItem()}
                            >
                              Agregar línea
                            </button>
                          </div>
                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                            <p className="text-[11px] font-bold uppercase text-slate-500">Excepciones / riders</p>
                            <p className="text-[10px] text-slate-500">
                              <strong>ADDITION</strong> suma al snapshot del acuerdo comercial por pallet.{" "}
                              <strong>REPLACE_BASE</strong> y <strong>SUPPRESS_BASE</strong> quedan para el cálculo por
                              fecha de viaje (Fase 3).
                            </p>
                            {(v.overrides ?? []).length > 0 ? (
                              <ul className="space-y-1 text-[10px] text-slate-700 dark:text-slate-300">
                                {(v.overrides ?? []).map((o: TransportTariffOverrideRow) => (
                                  <li key={o.id} className="flex flex-wrap items-start justify-between gap-2 rounded border border-slate-100 px-2 py-1 dark:border-slate-800">
                                    <span>
                                      <span className="font-semibold">{o.label}</span>{" "}
                                      <span className="text-slate-500">({o.action})</span>
                                      {o.baseItem ? (
                                        <span className="block text-slate-500">→ línea: {o.baseItem.label}</span>
                                      ) : null}
                                      <span className="block text-slate-500">
                                        {money(o.amount, o.currency)} · {new Date(o.validFrom).toLocaleDateString("es-CL")}
                                        {o.validTo ? ` – ${new Date(o.validTo).toLocaleDateString("es-CL")}` : ""}
                                      </span>
                                      <span className="block text-slate-500">Motivo: {o.reason}</span>
                                      {o.documentRef ? (
                                        <span className="block text-slate-500">Doc.: {o.documentRef}</span>
                                      ) : null}
                                    </span>
                                    <button
                                      type="button"
                                      className="shrink-0 text-red-600 underline"
                                      disabled={saving}
                                      onClick={() => void removeOverride(v.id, o)}
                                    >
                                      Quitar
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[10px] text-slate-500">Sin excepciones en esta versión.</p>
                            )}
                            <div className="grid gap-1 sm:grid-cols-2">
                              <select className="select-field-sm" value={ovAction} onChange={(e) => setOvAction(e.target.value)}>
                                {OVERRIDE_ACTIONS.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </select>
                              <select
                                className="select-field-sm"
                                value={ovBaseItemId}
                                onChange={(e) => setOvBaseItemId(e.target.value)}
                              >
                                <option value="">— Sin línea base (cargo adicional) —</option>
                                {v.items.map((it: TransportTariffItem) => (
                                  <option key={it.id} value={it.id}>
                                    {it.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="input-field-sm sm:col-span-2"
                                placeholder="Etiqueta excepción *"
                                value={ovLabel}
                                onChange={(e) => setOvLabel(e.target.value)}
                              />
                              <input
                                className="input-field-sm font-mono"
                                placeholder="Monto *"
                                value={ovAmount}
                                onChange={(e) => setOvAmount(e.target.value)}
                              />
                              <select className="select-field-sm" value={ovUnit} onChange={(e) => setOvUnit(e.target.value)}>
                                {UNIT_OPTIONS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                              <select className="select-field-sm" value={ovTax} onChange={(e) => setOvTax(e.target.value)}>
                                {TAX_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="input-field-sm sm:col-span-2"
                                placeholder="Motivo / acta *"
                                value={ovReason}
                                onChange={(e) => setOvReason(e.target.value)}
                              />
                              <input
                                className="input-field-sm sm:col-span-2"
                                placeholder="Referencia documento (email, nº acta…)"
                                value={ovDoc}
                                onChange={(e) => setOvDoc(e.target.value)}
                              />
                              <label className="text-[10px] text-slate-500">
                                Válido desde *
                                <input
                                  type="datetime-local"
                                  className="input-field-sm mt-0.5 w-full"
                                  value={ovValidFrom}
                                  onChange={(e) => setOvValidFrom(e.target.value)}
                                />
                              </label>
                              <label className="text-[10px] text-slate-500">
                                Válido hasta (opc.)
                                <input
                                  type="datetime-local"
                                  className="input-field-sm mt-0.5 w-full"
                                  value={ovValidTo}
                                  onChange={(e) => setOvValidTo(e.target.value)}
                                />
                              </label>
                              <button
                                type="button"
                                disabled={saving}
                                className="rounded bg-slate-700 px-3 py-1 text-[11px] font-semibold text-white sm:col-span-2 dark:bg-slate-300 dark:text-slate-900"
                                onClick={() => void addOverride(v.id)}
                              >
                                Agregar excepción
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default function LogisticaTransporteContratosPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Cargando…</p>}>
      <LogisticaTransporteContratosInner />
    </Suspense>
  );
}
