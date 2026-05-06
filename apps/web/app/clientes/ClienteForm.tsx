"use client";

import Link from "next/link";
import { useState } from "react";
import type { CreateClientInput, Client } from "../../lib/api";
import { formatRutInput, rutIsValid, rutToStorageString } from "../../lib/chile-inputs";

const TYPE_OPTIONS = [
  { value: "RESIDENCIAL", label: "Residencial" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "INDUSTRIAL", label: "Industrial" },
];

type Props =
  | { mode: "create"; onSubmit: (data: CreateClientInput) => Promise<void>; onCancel?: () => void }
  | {
      mode: "edit";
      initial: Client;
      onSubmit: (data: CreateClientInput) => Promise<void>;
      onCancel?: () => void;
    };

export function ClienteForm(props: Props) {
  const isEdit = props.mode === "edit";
  const initial = isEdit
    ? {
        type: props.initial.type,
        name: props.initial.name,
        taxId: formatRutInput(props.initial.taxId ?? ""),
        email: props.initial.email ?? "",
        phone: props.initial.phone ?? "",
        address: props.initial.address ?? "",
        notes: props.initial.notes ?? "",
      }
    : {
        type: "RESIDENCIAL",
        name: "",
        taxId: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      };

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const taxRaw = rutToStorageString(form.taxId);
    if (taxRaw.length > 0 && !rutIsValid(form.taxId)) {
      setError("RUT no válido (revise el dígito verificador).");
      return;
    }
    setSaving(true);
    try {
      await props.onSubmit({
        type: form.type,
        name: form.name.trim(),
        taxId: taxRaw || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-4"
      aria-invalid={!!error}
      aria-describedby={error ? "cliente-form-error" : undefined}
    >
      {error && (
        <div id="cliente-form-error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="type" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Tipo de cliente
        </label>
        <select
          id="type"
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          className="input-field"
          required
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Nombre o razón social *
        </label>
        <input
          id="name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="input-field"
          placeholder="Nombre del cliente"
          required
        />
      </div>

      <div>
        <label htmlFor="taxId" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          RUT
        </label>
        <input
          id="taxId"
          type="text"
          inputMode="text"
          autoComplete="off"
          value={form.taxId}
          onChange={(e) => setForm((f) => ({ ...f, taxId: formatRutInput(e.target.value) }))}
          className="input-field"
          placeholder="Ej. 12.345.678-9"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email (opcional)
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="input-field"
            placeholder="correo@ejemplo.com"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Teléfono (opcional)
          </label>
          <input
            id="phone"
            type="text"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="input-field"
            placeholder="Opcional"
          />
        </div>
      </div>

      <div>
<label htmlFor="address" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Dirección (opcional)
        </label>
        <input
          id="address"
          type="text"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          className="input-field"
          placeholder="Opcional"
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Notas (opcional)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="input-field"
          placeholder="Notas internas"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cliente"}
        </button>
        {props.onCancel ? (
          <button type="button" className="btn-secondary" onClick={props.onCancel}>
            Cancelar
          </button>
        ) : (
          <Link href="/clientes" className="btn-secondary">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
