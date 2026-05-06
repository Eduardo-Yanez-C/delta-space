"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../lib/auth-context";
import {
  activateSupplier,
  createSupplier,
  deactivateSupplier,
  deleteSupplier,
  fetchSuppliers,
  updateSupplier,
  type CreateSupplierInput,
  type Supplier,
} from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";
import { formatChileRutInput } from "../../../../lib/chile-rut-format";

const INVENTARIO = "/vista-previa-suite/logistica/inventario";
const TRANSPORTE = "/vista-previa-suite/logistica/transporte";
const CURRENCY_OPTIONS = ["CLP", "USD", "EUR", "UF", "MXN", "BRL", "PEN", "ARS", "COP"];

type ScopeTab = "all" | "local" | "international" | "transport";

const SUPPLY_ORIGIN_LABEL: Record<string, string> = {
  NACIONAL: "Local (nacional)",
  INTERNACIONAL: "Internacional",
};

const ACTOR_TYPE_LABEL: Record<string, string> = {
  FABRICANTE: "Fabricante",
  DISTRIBUIDOR: "Distribuidor",
  REPRESENTANTE: "Representante",
  IMPORTADOR: "Importador",
  INTEGRADOR: "Integrador",
  TRANSPORTISTA: "Transporte",
};

const ACTOR_OPTIONS = Object.keys(ACTOR_TYPE_LABEL);
const SUPPLY_OPTIONS = ["NACIONAL", "INTERNACIONAL"] as const;

function listFilters(scope: ScopeTab): { supplyOrigin?: string; actorType?: string } {
  switch (scope) {
    case "local":
      return { supplyOrigin: "NACIONAL" };
    case "international":
      return { supplyOrigin: "INTERNACIONAL" };
    case "transport":
      return { actorType: "TRANSPORTISTA" };
    default:
      return {};
  }
}

function emptyForm(): CreateSupplierInput {
  return {
    name: "",
    legalName: "",
    taxId: "",
    giro: "",
    commercialAddress: "",
    contactName: "",
    email: "",
    phone: "",
    country: "",
    city: "",
    defaultCurrency: "CLP",
    supplyOrigin: "NACIONAL",
    actorType: "DISTRIBUIDOR",
    paymentTerms: "",
    notes: "",
    active: true,
  };
}

function supplierToForm(s: Supplier): CreateSupplierInput {
  return {
    name: s.name,
    legalName: s.legalName ?? "",
    taxId: s.taxId ?? "",
    giro: (s as unknown as { giro?: string | null }).giro ?? "",
    commercialAddress: (s as unknown as { commercialAddress?: string | null }).commercialAddress ?? "",
    contactName: s.contactName ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    country: s.country ?? "",
    city: s.city ?? "",
    defaultCurrency: s.defaultCurrency ?? "",
    supplyOrigin: s.supplyOrigin,
    actorType: s.actorType,
    paymentTerms: s.paymentTerms ?? "",
    notes: s.notes ?? "",
    active: s.active,
  };
}

function LogisticaProveedoresInner() {
  const { user, loading: authLoading } = useAuth();
  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "logistica"),
    [user?.suiteNavGrants, user?.roles],
  );
  const canWrite = useMemo(() => {
    const r = user?.roles ?? [];
    return ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "INGENIERIA", "VENTAS"].some((x) => r.includes(x));
  }, [user?.roles]);

  const [scope, setScope] = useState<ScopeTab>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSupplierInput>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = listFilters(scope);
      const list = await fetchSuppliers({
        ...base,
        active: includeInactive ? undefined : true,
      });
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, includeInactive]);

  useEffect(() => {
    if (authLoading || !user || !canSee) return;
    void reload();
  }, [authLoading, user, canSee, reload]);

  function openCreate(preset?: Partial<CreateSupplierInput>) {
    setEditingId(null);
    setForm({ ...emptyForm(), ...preset });
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditingId(s.id);
    setForm(supplierToForm(s));
    setModalOpen(true);
  }

  async function onSubmitModal(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    const name = form.name.trim();
    if (!name) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateSupplierInput = {
        ...form,
        name,
        legalName: form.legalName?.trim() || undefined,
        taxId: form.taxId?.trim() || undefined,
        giro: form.giro?.trim() || undefined,
        commercialAddress: form.commercialAddress?.trim() || undefined,
        contactName: form.contactName?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        country: form.country?.trim() || undefined,
        city: form.city?.trim() || undefined,
        defaultCurrency: form.defaultCurrency?.trim() || undefined,
        paymentTerms: form.paymentTerms?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
        supplyOrigin: form.supplyOrigin,
        actorType: form.actorType,
        active: form.active ?? true,
      };
      if (editingId) {
        await updateSupplier(editingId, payload);
      } else {
        await createSupplier(payload);
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(s: Supplier) {
    if (!canWrite) return;
    setError(null);
    try {
      if (s.active) await deactivateSupplier(s.id);
      else await activateSupplier(s.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar estado");
    }
  }

  async function onDelete(id: string) {
    if (!canWrite) return;
    if (!window.confirm("¿Eliminar este proveedor? Se desvinculará de productos y precios si aplica. No se puede deshacer.")) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteSupplier(id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
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

  const scopeTabs: { id: ScopeTab; label: string; hint: string }[] = [
    { id: "all", label: "Todos", hint: "Catálogo completo" },
    { id: "local", label: "Locales", hint: "Origen nacional" },
    { id: "international", label: "Internacionales", hint: "Origen fuera de Chile" },
    { id: "transport", label: "Transporte", hint: "Transportistas y flota" },
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-5 md:px-6">
      <header className="space-y-3 border-b border-slate-200 pb-4 dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Logística</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Proveedores</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Un solo maestro para <strong className="font-medium text-slate-800 dark:text-slate-200">materiales</strong>{" "}
              (nacional / internacional) y <strong className="font-medium text-slate-800 dark:text-slate-200">transporte</strong>.
              Los transportistas aparecen en la pestaña Transporte y en datalists de{" "}
              <Link href={TRANSPORTE} className="text-amber-700 underline dark:text-amber-400">
                Transporte
              </Link>
              .
            </p>
          </div>
          {canWrite ? (
            <button
              type="button"
              onClick={() => openCreate(scope === "transport" ? { actorType: "TRANSPORTISTA" } : {})}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500"
            >
              Nuevo proveedor
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={INVENTARIO} className="font-medium text-primary-600 underline dark:text-primary-400">
            Inventario
          </Link>
          <Link href={TRANSPORTE} className="font-medium text-primary-600 underline dark:text-primary-400">
            Transporte
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-600">
          {scopeTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => setScope(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                scope === t.id
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-slate-400"
          />
          Incluir inactivos
        </label>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-600 dark:text-slate-400">No hay proveedores en este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="hidden px-3 py-2 sm:table-cell">Origen</th>
                  <th className="hidden px-3 py-2 md:table-cell">Rol</th>
                  <th className="hidden px-3 py-2 lg:table-cell">Ciudad / país</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((s) => (
                  <tr key={s.id} className={s.active ? "" : "opacity-70"}>
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                      {s.taxId ? (
                        <span className="mt-0.5 block font-mono text-[11px] text-slate-500">{s.taxId}</span>
                      ) : null}
                      {(s as unknown as { commercialAddress?: string | null }).commercialAddress?.trim() ? (
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {(s as unknown as { commercialAddress?: string | null }).commercialAddress}
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden px-3 py-2 text-slate-600 dark:text-slate-300 sm:table-cell">
                      {SUPPLY_ORIGIN_LABEL[s.supplyOrigin] ?? s.supplyOrigin}
                    </td>
                    <td className="hidden px-3 py-2 text-slate-600 dark:text-slate-300 md:table-cell">
                      {ACTOR_TYPE_LABEL[s.actorType] ?? s.actorType}
                    </td>
                    <td className="hidden px-3 py-2 text-slate-600 dark:text-slate-300 lg:table-cell">
                      {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          s.active
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {s.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canWrite ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium dark:border-slate-600"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void onToggleActive(s)}
                            className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium dark:border-slate-600"
                          >
                            {s.active ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === s.id}
                            onClick={() => void onDelete(s.id)}
                            className="rounded border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300"
                          >
                            {deletingId === s.id ? "…" : "Eliminar"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog">
          <form
            onSubmit={(e) => void onSubmitModal(e)}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editingId ? "Editar proveedor" : "Nuevo proveedor"}
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="sm:col-span-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Nombre comercial *
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                />
              </label>
              <label className="sm:col-span-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Razón social
                <input
                  value={form.legalName ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                RUT / Tax ID
                <input
                  value={form.taxId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, taxId: formatChileRutInput(e.target.value) }))}
                  className="input-field-sm mt-0.5 w-full"
                  placeholder="10.111.000-1"
                  maxLength={14}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Giro
                <input
                  value={(form.giro ?? "") as string}
                  onChange={(e) => setForm((f) => ({ ...f, giro: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                  placeholder="Ej. Transporte de carga, servicios logísticos…"
                />
              </label>
              <label className="sm:col-span-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Dirección comercial
                <input
                  value={(form.commercialAddress ?? "") as string}
                  onChange={(e) => setForm((f) => ({ ...f, commercialAddress: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                  placeholder="Ej. Av. Apoquindo 1234, Las Condes…"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Moneda habitual
                <select
                  value={(form.defaultCurrency ?? "CLP") as string}
                  onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value }))}
                  className="select-field-sm mt-0.5 w-full"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Origen de suministro *
                <select
                  required
                  value={form.supplyOrigin}
                  onChange={(e) => setForm((f) => ({ ...f, supplyOrigin: e.target.value }))}
                  className="select-field-sm mt-0.5 w-full"
                >
                  {SUPPLY_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {SUPPLY_ORIGIN_LABEL[o]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Rol en la cadena *
                <select
                  required
                  value={form.actorType}
                  onChange={(e) => setForm((f) => ({ ...f, actorType: e.target.value }))}
                  className="select-field-sm mt-0.5 w-full"
                >
                  {ACTOR_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {ACTOR_TYPE_LABEL[o] ?? o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Contacto
                <input
                  value={form.contactName ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Email
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Teléfono
                <input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Ciudad
                <input
                  value={form.city ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                País
                <input
                  value={form.country ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                />
              </label>
              <label className="sm:col-span-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Condiciones de pago
                <input
                  value={form.paymentTerms ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                  className="input-field-sm mt-0.5 w-full"
                />
              </label>
              <label className="sm:col-span-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Notas
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="input-field-sm mt-0.5 min-h-[56px] w-full"
                  rows={2}
                />
              </label>
              <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.active ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="rounded border-slate-400"
                />
                Activo (visible en listas y datalists)
              </label>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

export default function LogisticaProveedoresPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Cargando…</p>}>
      <LogisticaProveedoresInner />
    </Suspense>
  );
}
