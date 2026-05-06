"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../lib/auth-context";
import {
  createTransportVariable,
  createTransportVariableProfile,
  createTransportVariableValue,
  deleteTransportVariableProfile,
  deleteTransportVariableValue,
  fetchSuiteProjects,
  fetchTransportVariable,
  fetchTransportVariableProfiles,
  fetchTransportVariablesCatalog,
  resolveTransportVariablesAt,
  updateSuiteProject,
  type SuiteProjectRow,
  type TransportVariableCatalogRow,
  type TransportVariableDetail,
  type TransportVariableProfileRow,
  type TransportVariableResolvedRow,
  type TransportVariableValueRow,
} from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";

const CONTRATOS = "/vista-previa-suite/logistica/transporte-contratos";
const TRANSPORTE = "/vista-previa-suite/logistica/transporte";

const SOURCE_OPTS = ["MANUAL", "API", "IMPORT"] as const;

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LogisticaTransporteVariablesInner() {
  const { user, loading: authLoading } = useAuth();
  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "logistica"),
    [user?.suiteNavGrants, user?.roles],
  );
  const canWrite = useMemo(() => {
    const r = user?.roles ?? [];
    return ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "INGENIERIA", "VENTAS"].some((x) => r.includes(x));
  }, [user?.roles]);

  const [profiles, setProfiles] = useState<TransportVariableProfileRow[]>([]);
  const [catalog, setCatalog] = useState<TransportVariableCatalogRow[]>([]);
  const [projects, setProjects] = useState<SuiteProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const [varDetail, setVarDetail] = useState<TransportVariableDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [newProfileName, setNewProfileName] = useState("");
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarLabel, setNewVarLabel] = useState("");
  const [newVarUnit, setNewVarUnit] = useState("");

  const [valAmount, setValAmount] = useState("");
  const [valUnit, setValUnit] = useState("");
  const [valFrom, setValFrom] = useState(() => toDatetimeLocal(new Date()));
  const [valTo, setValTo] = useState("");
  const [valProfileId, setValProfileId] = useState("");
  const [valSource, setValSource] = useState<string>("MANUAL");
  const [valNote, setValNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [resolveAt, setResolveAt] = useState(() => toDatetimeLocal(new Date()));
  const [resolveProfileId, setResolveProfileId] = useState("");
  const [resolved, setResolved] = useState<TransportVariableResolvedRow[] | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [p, c, pr] = await Promise.all([
        fetchTransportVariableProfiles(),
        fetchTransportVariablesCatalog(),
        fetchSuiteProjects(),
      ]);
      setProfiles(p);
      setCatalog(c);
      setProjects(pr);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canSee) return;
    void reload();
  }, [canSee, reload]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setFormErr(null);
    try {
      const d = await fetchTransportVariable(id);
      setVarDetail(d);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
      setVarDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedVarId) {
      setVarDetail(null);
      return;
    }
    void loadDetail(selectedVarId);
  }, [selectedVarId, loadDetail]);

  const onCreateProfile = async () => {
    if (!canWrite || !newProfileName.trim()) return;
    setSaving(true);
    setFormErr(null);
    try {
      await createTransportVariableProfile({ name: newProfileName.trim() });
      setNewProfileName("");
      await reload();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteProfile = async (id: string) => {
    if (!canWrite || !window.confirm("¿Eliminar perfil? Se borran sus valores asociados y referencias en contratos/proyectos quedarán en null."))
      return;
    setSaving(true);
    setFormErr(null);
    try {
      await deleteTransportVariableProfile(id);
      if (valProfileId === id) setValProfileId("");
      if (resolveProfileId === id) setResolveProfileId("");
      await reload();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const onCreateVariable = async () => {
    if (!canWrite || !newVarKey.trim() || !newVarLabel.trim()) return;
    setSaving(true);
    setFormErr(null);
    try {
      const v = await createTransportVariable({
        key: newVarKey.trim(),
        label: newVarLabel.trim(),
        defaultUnit: newVarUnit.trim() || null,
      });
      setNewVarKey("");
      setNewVarLabel("");
      setNewVarUnit("");
      await reload();
      setSelectedVarId(v.id);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const onAddValue = async () => {
    if (!canWrite || !varDetail) return;
    const n = parseFloat(valAmount.replace(",", "."));
    setSaving(true);
    setFormErr(null);
    try {
      if (Number.isNaN(n)) throw new Error("Indique un valor numérico.");
      await createTransportVariableValue(varDetail.id, {
        value: n,
        unit: valUnit.trim() || null,
        validFrom: new Date(valFrom).toISOString(),
        validTo: valTo.trim() ? new Date(valTo).toISOString() : null,
        profileId: valProfileId.trim() || null,
        source: valSource,
        note: valNote.trim() || null,
      });
      setValAmount("");
      setValNote("");
      await loadDetail(varDetail.id);
      await reload();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteValue = async (row: TransportVariableValueRow) => {
    if (!canWrite || !varDetail) return;
    if (!window.confirm("¿Eliminar este registro histórico?")) return;
    setSaving(true);
    setFormErr(null);
    try {
      await deleteTransportVariableValue(varDetail.id, row.id);
      await loadDetail(varDetail.id);
      await reload();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const onSaveProjectProfile = async (projectId: string, profileId: string) => {
    if (!canWrite) return;
    setSaving(true);
    setFormErr(null);
    try {
      await updateSuiteProject(projectId, {
        transportVariableProfileId: profileId.trim() || null,
      });
      await reload();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const runResolve = async () => {
    setFormErr(null);
    try {
      const rows = await resolveTransportVariablesAt({
        at: new Date(resolveAt).toISOString(),
        profileId: resolveProfileId.trim() || null,
      });
      setResolved(rows);
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Error");
      setResolved(null);
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
          Logística · Transporte · Fase 2
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Variables de mercado (Inputs)
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Parámetros con historial y vigencia (diesel, UF, km, peajes…). Los viajes futuros usarán el valor vigente a
              la <strong className="font-medium text-slate-800 dark:text-slate-200">fecha del viaje</strong>, sin pisar
              registros pasados. Perfiles nombrados se asignan a contratos o proyectos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={CONTRATOS} className="text-primary-600 underline dark:text-primary-400">
              Contratos
            </Link>
            <Link href={TRANSPORTE} className="text-primary-600 underline dark:text-primary-400">
              Transporte
            </Link>
          </div>
        </div>
      </header>

      {err ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p> : null}
      {formErr ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{formErr}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h2 className="text-xs font-bold uppercase text-slate-500">Vista previa de resolución</h2>
        <p className="mt-1 text-xs text-slate-500">
          Simula qué valor aplica cada variable activa: primero filas del perfil; si no hay, cae a valores{" "}
          <span className="font-medium">globales</span> (sin perfil).
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Fecha / hora de corte
            <input
              type="datetime-local"
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={resolveAt}
              onChange={(e) => setResolveAt(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Perfil (opcional)
            <select
              className="mt-1 block min-w-[200px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
              value={resolveProfileId}
              onChange={(e) => setResolveProfileId(e.target.value)}
            >
              <option value="">— Solo global —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void runResolve()}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900"
          >
            Resolver ahora
          </button>
        </div>
        {resolved ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="py-1 pr-3">Clave</th>
                  <th className="py-1 pr-3">Etiqueta</th>
                  <th className="py-1 pr-3">Valor</th>
                  <th className="py-1 pr-3">Unidad</th>
                  <th className="py-1 pr-3">válido desde</th>
                  <th className="py-1">Origen fila</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((r) => (
                  <tr key={r.variableId} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1 pr-3 font-mono text-slate-800 dark:text-slate-200">{r.key}</td>
                    <td className="py-1 pr-3">{r.label}</td>
                    <td className="py-1 pr-3">
                      {r.resolved ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{r.resolved.value}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-1 pr-3">{r.resolved?.unit ?? r.defaultUnit ?? "—"}</td>
                    <td className="py-1 pr-3">
                      {r.resolved ? new Date(r.resolved.validFrom).toLocaleString("es-CL") : "—"}
                    </td>
                    <td className="py-1">
                      {r.resolved ? (
                        <span className="text-slate-600 dark:text-slate-400">
                          {r.resolved.profileId ? "perfil" : "global"} · {r.resolved.source}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-xs font-bold uppercase text-slate-500">Perfiles</h2>
          {loading ? <p className="mt-2 text-sm text-slate-500">Cargando…</p> : null}
          {!loading && profiles.length === 0 ? <p className="mt-2 text-sm text-slate-500">Sin perfiles aún.</p> : null}
          <ul className="mt-2 space-y-1 text-sm">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1 dark:border-slate-800"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                <span className="text-[11px] text-slate-500">
                  {p._count.values} valores · {p._count.contracts} contratos · {p._count.projects} proyectos
                </span>
                {canWrite ? (
                  <button
                    type="button"
                    className="text-[11px] text-red-600 underline"
                    disabled={saving}
                    onClick={() => void onDeleteProfile(p.id)}
                  >
                    Eliminar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canWrite ? (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <input
                className="input-field-sm min-w-[180px]"
                placeholder="Nombre perfil (ej. Coyhaique Q2 2026)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
              />
              <button
                type="button"
                disabled={saving}
                className="rounded-md bg-primary-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                onClick={() => void onCreateProfile()}
              >
                Crear perfil
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-xs font-bold uppercase text-slate-500">Asignación por proyecto</h2>
          <p className="mt-1 text-xs text-slate-500">
            El contrato de transporte puede tener su propio perfil; si no, en el futuro el cálculo podrá usar el del
            proyecto.
          </p>
          <div className="mt-2 max-h-[280px] space-y-2 overflow-y-auto text-xs">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded border border-slate-100 px-2 py-1.5 dark:border-slate-800"
              >
                <span className="min-w-[100px] font-medium text-slate-800 dark:text-slate-200">{p.code}</span>
                <select
                  className="min-w-[200px] flex-1 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                  value={p.transportVariableProfileId ?? ""}
                  disabled={!canWrite || saving}
                  onChange={(e) => void onSaveProjectProfile(p.id, e.target.value)}
                >
                  <option value="">— Sin perfil —</option>
                  {profiles.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h2 className="text-xs font-bold uppercase text-slate-500">Catálogo de variables</h2>
        {canWrite ? (
          <div className="mt-2 flex flex-wrap items-end gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <input
              className="input-field-sm w-32 font-mono text-xs"
              placeholder="CLAVE"
              value={newVarKey}
              onChange={(e) => setNewVarKey(e.target.value)}
            />
            <input
              className="input-field-sm min-w-[160px] flex-1"
              placeholder="Etiqueta"
              value={newVarLabel}
              onChange={(e) => setNewVarLabel(e.target.value)}
            />
            <input
              className="input-field-sm w-24"
              placeholder="Ud. def."
              value={newVarUnit}
              onChange={(e) => setNewVarUnit(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              className="rounded-md bg-slate-800 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-200 dark:text-slate-900 disabled:opacity-50"
              onClick={() => void onCreateVariable()}
            >
              Alta
            </button>
          </div>
        ) : null}
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ul className="max-h-[min(60vh,420px)] space-y-1 overflow-y-auto text-sm">
            {catalog.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => setSelectedVarId(v.id)}
                  className={`w-full rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                    selectedVarId === v.id
                      ? "border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/40"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/80"
                  } ${!v.active ? "opacity-50" : ""}`}
                >
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{v.key}</span>
                  <span className="mt-0.5 block text-slate-600 dark:text-slate-400">{v.label}</span>
                  <span className="text-[10px] text-slate-500">{v._count.values} registros históricos</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
            {!selectedVarId ? (
              <p className="text-sm text-slate-500">Seleccione una variable.</p>
            ) : detailLoading ? (
              <p className="text-sm text-slate-500">Cargando…</p>
            ) : varDetail ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{varDetail.key}</span>
                  <p className="text-slate-600 dark:text-slate-400">{varDetail.label}</p>
                  {varDetail.defaultUnit ? (
                    <p className="text-slate-500">Unidad por defecto: {varDetail.defaultUnit}</p>
                  ) : null}
                </div>
                {canWrite ? (
                  <div className="space-y-2 rounded border border-dashed border-slate-200 p-2 dark:border-slate-700">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Nuevo tramo de vigencia</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        Valor
                        <input
                          className="input-field-sm mt-0.5 w-full"
                          value={valAmount}
                          onChange={(e) => setValAmount(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        Unidad (opc.)
                        <input
                          className="input-field-sm mt-0.5 w-full"
                          value={valUnit}
                          onChange={(e) => setValUnit(e.target.value)}
                          placeholder={varDetail.defaultUnit ?? ""}
                        />
                      </label>
                      <label className="block">
                        Válido desde
                        <input
                          type="datetime-local"
                          className="input-field-sm mt-0.5 w-full"
                          value={valFrom}
                          onChange={(e) => setValFrom(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        Válido hasta (opc.)
                        <input
                          type="datetime-local"
                          className="input-field-sm mt-0.5 w-full"
                          value={valTo}
                          onChange={(e) => setValTo(e.target.value)}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        Perfil (vacío = global)
                        <select
                          className="select-field-sm mt-0.5 w-full"
                          value={valProfileId}
                          onChange={(e) => setValProfileId(e.target.value)}
                        >
                          <option value="">— Global —</option>
                          {profiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        Fuente
                        <select
                          className="select-field-sm mt-0.5 w-full"
                          value={valSource}
                          onChange={(e) => setValSource(e.target.value)}
                        >
                          {SOURCE_OPTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="sm:col-span-2 block">
                        Nota
                        <input
                          className="input-field-sm mt-0.5 w-full"
                          value={valNote}
                          onChange={(e) => setValNote(e.target.value)}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      className="rounded-md bg-primary-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      onClick={() => void onAddValue()}
                    >
                      Agregar valor
                    </button>
                  </div>
                ) : null}
                <div className="max-h-[280px] overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                        <th className="py-1 pr-2">Valor</th>
                        <th className="py-1 pr-2">Desde</th>
                        <th className="py-1 pr-2">Hasta</th>
                        <th className="py-1 pr-2">Ámbito</th>
                        <th className="py-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {varDetail.values.map((row) => (
                        <tr key={row.id} className="border-b border-slate-50 dark:border-slate-800/80">
                          <td className="py-1 pr-2">
                            {row.value}
                            {row.unit ? ` ${row.unit}` : ""}
                          </td>
                          <td className="py-1 pr-2">{new Date(row.validFrom).toLocaleString("es-CL")}</td>
                          <td className="py-1 pr-2">
                            {row.validTo ? new Date(row.validTo).toLocaleString("es-CL") : "—"}
                          </td>
                          <td className="py-1 pr-2">
                            {row.profile ? row.profile.name : "Global"} · {row.source}
                          </td>
                          <td className="py-1">
                            {canWrite ? (
                              <button
                                type="button"
                                className="text-red-600 underline"
                                disabled={saving}
                                onClick={() => void onDeleteValue(row)}
                              >
                                Borrar
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sin datos.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function LogisticaTransporteVariablesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Cargando…</p>}>
      <LogisticaTransporteVariablesInner />
    </Suspense>
  );
}
