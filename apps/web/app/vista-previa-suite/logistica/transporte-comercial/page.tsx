"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../../../lib/auth-context";
import {
  createTransportCommercialTariff,
  deleteTransportCommercialTariff,
  fetchSuiteProjects,
  fetchSuppliers,
  fetchTransportCommercialTariffs,
  updateTransportCommercialTariff,
  type SuiteProjectRow,
  type Supplier,
  type TransportCommercialTariff,
} from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";

const INVENTARIO = "/vista-previa-suite/logistica/inventario";
const TRANSPORTE = "/vista-previa-suite/logistica/transporte";

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

function LogisticaTransporteComercialInner() {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId")?.trim() ?? "";
  const { user, loading: authLoading } = useAuth();
  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "logistica"),
    [user?.suiteNavGrants, user?.roles],
  );
  const canWrite = useMemo(() => {
    const r = user?.roles ?? [];
    return ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "INGENIERIA", "VENTAS"].some((x) =>
      r.includes(x),
    );
  }, [user?.roles]);

  const [projects, setProjects] = useState<SuiteProjectRow[]>([]);
  const [filterProjectId, setFilterProjectId] = useState(urlProjectId);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tariffs, setTariffs] = useState<TransportCommercialTariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TransportCommercialTariff | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [projectId, setProjectId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [originHint, setOriginHint] = useState("");
  const [destinationHint, setDestinationHint] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [currency, setCurrency] = useState("CLP");
  const [fuelPct, setFuelPct] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, p, s] = await Promise.all([
        fetchTransportCommercialTariffs({
          projectId: filterProjectId.trim() || null,
        }),
        fetchSuiteProjects(),
        fetchSuppliers({ actorType: "TRANSPORTISTA", active: true }),
      ]);
      setTariffs(t);
      setProjects(p);
      setSuppliers(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
      setTariffs([]);
    } finally {
      setLoading(false);
    }
  }, [filterProjectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (urlProjectId && !filterProjectId) setFilterProjectId(urlProjectId);
  }, [urlProjectId, filterProjectId]);

  const openNew = () => {
    setEditing(null);
    setFormError(null);
    setLabel("");
    setProjectId(filterProjectId.trim() || "");
    setSupplierId("");
    setOriginHint("");
    setDestinationHint("");
    setBaseAmount("");
    setCurrency("CLP");
    setFuelPct("");
    setNotes("");
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (row: TransportCommercialTariff) => {
    setEditing(row);
    setFormError(null);
    setLabel(row.label);
    setProjectId(row.projectId ?? "");
    setSupplierId(row.supplierId ?? "");
    setOriginHint(row.originHint ?? "");
    setDestinationHint(row.destinationHint ?? "");
    setBaseAmount(String(row.baseAmount));
    setCurrency(row.currency || "CLP");
    setFuelPct(row.fuelAdjustmentPercent != null ? String(row.fuelAdjustmentPercent) : "");
    setNotes(row.notes ?? "");
    setActive(row.active);
    setModalOpen(true);
  };

  const onSubmitModal = async () => {
    if (!canWrite) return;
    setSaving(true);
    setFormError(null);
    try {
      const base = parseFloat(baseAmount.trim().replace(",", "."));
      if (Number.isNaN(base) || base < 0) throw new Error("Monto base inválido.");
      const fuel =
        fuelPct.trim() === "" ? null : parseFloat(fuelPct.trim().replace(",", "."));
      if (fuel != null && Number.isNaN(fuel)) throw new Error("% combustible inválido.");
      const body = {
        label: label.trim(),
        projectId: projectId.trim() || null,
        supplierId: supplierId.trim() || null,
        originHint: originHint.trim() || null,
        destinationHint: destinationHint.trim() || null,
        baseAmount: base,
        currency,
        fuelAdjustmentPercent: fuel,
        notes: notes.trim() || null,
        active,
      };
      if (!body.label) throw new Error("Indique un nombre de ruta / concepto.");
      if (editing) {
        await updateTransportCommercialTariff(editing.id, body);
      } else {
        await createTransportCommercialTariff(body);
      }
      setModalOpen(false);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: TransportCommercialTariff) => {
    if (!canWrite) return;
    if (!window.confirm(`¿Eliminar plantilla «${row.label}»?`)) return;
    try {
      await deleteTransportCommercialTariff(row.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  };

  if (authLoading) {
    return <p className="p-6 text-sm text-slate-600">Cargando…</p>;
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
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        No tiene permiso para ver Logística.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[92rem] space-y-4 px-3 py-3 md:px-4">
      <header className="space-y-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Logística
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Transporte comercial
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Plantillas de precio por proyecto y transportista. En{" "}
              <Link href={TRANSPORTE} className="font-medium text-primary-600 underline dark:text-primary-400">
                Transporte
              </Link>{" "}
              se registra el acuerdo por cada pallet (plantilla + % o monto manual).
            </p>
          </div>
          {canWrite ? (
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
            >
              Nueva plantilla
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Filtrar por proyecto
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="mt-1 block min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            >
              <option value="">Todos (mostrar todas las plantillas)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={
                filterProjectId
                  ? `${TRANSPORTE}?projectId=${encodeURIComponent(filterProjectId)}`
                  : TRANSPORTE
              }
              className="font-medium text-primary-600 underline dark:text-primary-400"
            >
              Volver a Transporte
            </Link>
            <Link href={INVENTARIO} className="font-medium text-primary-600 underline dark:text-primary-400">
              Inventario
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando plantillas…</p>
      ) : tariffs.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No hay plantillas{filterProjectId ? " para este proyecto" : ""}. Cree una para reutilizar precios base y % sugerido de combustible.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2">Concepto / ruta</th>
                <th className="px-3 py-2">Proyecto</th>
                <th className="px-3 py-2">Transportista</th>
                <th className="px-3 py-2">Base</th>
                <th className="px-3 py-2">% sug.</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tariffs.map((t) => (
                <tr key={t.id} className="text-slate-800 dark:text-slate-100">
                  <td className="px-3 py-2">
                    <span className="font-medium">{t.label}</span>
                    {t.originHint || t.destinationHint ? (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {[t.originHint, t.destinationHint].filter(Boolean).join(" → ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.project ? `${t.project.code}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{t.supplier?.name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{money(t.baseAmount, t.currency)}</td>
                  <td className="px-3 py-2 text-xs">
                    {t.fuelAdjustmentPercent != null ? `${t.fuelAdjustmentPercent}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{t.active ? "Activa" : "Inactiva"}</td>
                  <td className="px-3 py-2 text-right">
                    {canWrite ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="text-xs font-semibold text-primary-600 underline dark:text-primary-400"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(t)}
                          className="text-xs font-semibold text-red-600 underline dark:text-red-400"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm"
            aria-label="Cerrar"
            onClick={() => setModalOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-[85] w-[min(100vw-24px,480px)] max-h-[min(90vh,620px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editing ? "Editar plantilla" : "Nueva plantilla"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="suite-scroll max-h-[min(70vh,520px)] space-y-3 overflow-y-auto p-4">
              {formError ? (
                <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {formError}
                </div>
              ) : null}
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Nombre / ruta
                <input
                  className="input-field-sm mt-1 w-full"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ej. Full Stgo–Obra norte"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Proyecto (opcional)
                <select
                  className="select-field-sm mt-1 w-full"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">— Cualquier proyecto —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Transportista (opcional)
                <select
                  className="select-field-sm mt-1 w-full"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Origen (texto)
                <input
                  className="input-field-sm mt-1 w-full"
                  value={originHint}
                  onChange={(e) => setOriginHint(e.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Destino (texto)
                <input
                  className="input-field-sm mt-1 w-full"
                  value={destinationHint}
                  onChange={(e) => setDestinationHint(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Monto base
                  <input
                    className="input-field-sm mt-1 w-full font-mono"
                    inputMode="decimal"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Moneda
                  <select
                    className="select-field-sm mt-1 w-full"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                % combustible sugerido (sobre base)
                <input
                  className="input-field-sm mt-1 w-full"
                  inputMode="decimal"
                  value={fuelPct}
                  onChange={(e) => setFuelPct(e.target.value)}
                  placeholder="Ej. 4.5"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Notas
                <textarea
                  className="input-field-sm mt-1 min-h-[64px] w-full resize-y"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Activa
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || !canWrite}
                onClick={() => void onSubmitModal()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function LogisticaTransporteComercialPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Cargando…</p>}>
      <LogisticaTransporteComercialInner />
    </Suspense>
  );
}
