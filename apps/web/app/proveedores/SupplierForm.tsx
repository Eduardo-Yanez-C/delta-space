"use client";

import { useState } from "react";
import Link from "next/link";
import type { Supplier, CreateSupplierInput, UpdateSupplierInput } from "../../lib/api";

const SUPPLY_ORIGINS = [
  { value: "NACIONAL", label: "Nacional" },
  { value: "INTERNACIONAL", label: "Internacional" },
];
const ACTOR_TYPES = [
  { value: "FABRICANTE", label: "Fabricante" },
  { value: "DISTRIBUIDOR", label: "Distribuidor" },
  { value: "REPRESENTANTE", label: "Representante" },
  { value: "IMPORTADOR", label: "Importador" },
  { value: "INTEGRADOR", label: "Integrador" },
];

type Props =
  | { mode: "create"; onSubmit: (data: CreateSupplierInput) => Promise<void> }
  | { mode: "edit"; initial: Supplier; onSubmit: (data: UpdateSupplierInput) => Promise<void> };

export function SupplierForm(props: Props) {
  const isEdit = props.mode === "edit";
  const initial = isEdit
    ? {
        name: props.initial.name,
        legalName: props.initial.legalName ?? "",
        taxId: props.initial.taxId ?? "",
        contactName: props.initial.contactName ?? "",
        email: props.initial.email ?? "",
        phone: props.initial.phone ?? "",
        country: props.initial.country ?? "",
        city: props.initial.city ?? "",
        defaultCurrency: props.initial.defaultCurrency ?? "",
        supplyOrigin: props.initial.supplyOrigin,
        actorType: props.initial.actorType,
        paymentTerms: props.initial.paymentTerms ?? "",
        leadTimeDays: props.initial.leadTimeDays ?? "",
        notes: props.initial.notes ?? "",
        active: props.initial.active,
      }
    : {
        name: "",
        legalName: "",
        taxId: "",
        contactName: "",
        email: "",
        phone: "",
        country: "",
        city: "",
        defaultCurrency: "CLP",
        supplyOrigin: "NACIONAL",
        actorType: "DISTRIBUIDOR",
        paymentTerms: "",
        leadTimeDays: "",
        notes: "",
        active: true,
      };

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await props.onSubmit({
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        country: form.country.trim() || undefined,
        city: form.city.trim() || undefined,
        defaultCurrency: form.defaultCurrency.trim() || undefined,
        supplyOrigin: form.supplyOrigin,
        actorType: form.actorType,
        paymentTerms: form.paymentTerms.trim() || undefined,
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
        notes: form.notes.trim() || undefined,
        ...(isEdit && { active: form.active }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="input-field"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Razón social</label>
        <input
          type="text"
          value={form.legalName}
          onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
          className="input-field"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">RUT / Identificación fiscal</label>
        <input
          type="text"
          value={form.taxId}
          onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
          className="input-field"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Contacto</label>
        <input
          type="text"
          value={form.contactName}
          onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
          className="input-field"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="input-field"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">País</label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ciudad</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="input-field"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Moneda habitual</label>
        <input
          type="text"
          value={form.defaultCurrency}
          onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value }))}
          className="input-field"
          placeholder="USD, CLP, EUR..."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Origen de abastecimiento *</label>
          <select
            value={form.supplyOrigin}
            onChange={(e) => setForm((f) => ({ ...f, supplyOrigin: e.target.value }))}
            className="input-field"
            required
          >
            {SUPPLY_ORIGINS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de actor *</label>
          <select
            value={form.actorType}
            onChange={(e) => setForm((f) => ({ ...f, actorType: e.target.value }))}
            className="input-field"
            required
          >
            {ACTOR_TYPES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Condiciones de pago</label>
        <input
          type="text"
          value={form.paymentTerms}
          onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
          className="input-field"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Lead time (días)</label>
        <input
          type="number"
          min={0}
          value={form.leadTimeDays}
          onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
          className="input-field"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Observaciones</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="input-field"
        />
      </div>
      {isEdit && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label htmlFor="active" className="text-sm font-medium text-slate-700 dark:text-slate-300">Activo</label>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear proveedor"}
        </button>
        <Link href="/proveedores" className="btn-secondary">Cancelar</Link>
      </div>
    </form>
  );
}
