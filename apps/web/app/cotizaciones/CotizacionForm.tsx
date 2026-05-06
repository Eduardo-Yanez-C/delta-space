"use client";

import { useState, useEffect, useCallback } from "react";
import { lockBodyScroll, unlockBodyScroll } from "../../lib/body-scroll-lock";
import Link from "next/link";
import {
  fetchClients,
  createClient,
  fetchUsers,
  type Client,
  type CreateClientInput,
  type User,
} from "../../lib/api";
import type { CreateQuoteInput, UpdateQuoteInput } from "../../lib/api";
import type { QuoteDetail } from "../../lib/api";
import {
  emptyMarginTechnicalForm,
  mergeMarginTechnicalBasics,
  MARGIN_CONNECTION_OPTIONS,
  MARGIN_MOUNT_STRUCTURE_OPTIONS,
  MARGIN_SYSTEM_TYPE_OPTIONS,
  parseMarginAdvancedJson,
  splitMarginTechnicalBasics,
  stripKnownMarginKeys,
  type MarginTechnicalFormValues,
} from "../../lib/margin-technical-basics";

/** Valores internos para projectType (consistentes con backend/modelo). Labels solo en UI. */
const PROJECT_TYPE_OPTIONS = [
  { value: "RESIDENCIAL", label: "Residencial" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "INDUSTRIAL", label: "Industrial" },
] as const;

const CLIENT_TYPE_OPTIONS = [
  { value: "RESIDENCIAL", label: "Residencial" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "INDUSTRIAL", label: "Industrial" },
] as const;

type Props =
  | {
      mode: "create";
      onSubmit: (data: CreateQuoteInput) => Promise<void>;
      /** Solo flujo MARGIN: muestra parámetros técnicos base. */
      enableMarginTechnicalBasics?: boolean;
    }
  | { mode: "edit"; initial: QuoteDetail; onSubmit: (data: UpdateQuoteInput) => Promise<void> };

export function CotizacionForm(props: Props) {
  const isEdit = props.mode === "edit";
  const showMarginTechnicalBasics =
    (isEdit && props.initial.quoteKind === "MARGIN") ||
    (!isEdit && props.enableMarginTechnicalBasics === true);

  const initial = isEdit
    ? {
        clientId: props.initial.clientId,
        title: props.initial.title,
        projectType: props.initial.projectType,
        internalNotes: props.initial.internalNotes ?? "",
        clientNotes: props.initial.clientNotes ?? "",
        currency: props.initial.currency ?? "",
        validUntil: props.initial.validUntil ? props.initial.validUntil.slice(0, 10) : "",
        paymentTerms: props.initial.paymentTerms ?? "",
        deliveryDays: props.initial.deliveryDays != null ? String(props.initial.deliveryDays) : "",
        commercialStage: props.initial.commercialStage ?? "",
        leadNumber: props.initial.leadNumber ?? "",
        salespersonId: props.initial.salespersonId ?? "",
      }
    : {
        clientId: "",
        title: "",
        projectType: "RESIDENCIAL",
        internalNotes: "",
        clientNotes: "",
        currency: "CLP",
        validUntil: "",
        paymentTerms: "",
        deliveryDays: "",
        commercialStage: "",
        leadNumber: "",
        salespersonId: "",
      };

  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(initial);
  const [marginUnknownJson, setMarginUnknownJson] = useState<Record<string, unknown>>({});
  const [marginForm, setMarginForm] = useState<MarginTechnicalFormValues>(emptyMarginTechnicalForm);
  const [marginAdvOpen, setMarginAdvOpen] = useState(false);
  const [marginAdvText, setMarginAdvText] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState<{
    type: string;
    name: string;
    email: string;
    phone: string;
    leadNumber: string;
    salespersonId: string;
  }>({
    type: "RESIDENCIAL",
    name: "",
    email: "",
    phone: "",
    leadNumber: "",
    salespersonId: "",
  });
  const [newClientSaving, setNewClientSaving] = useState(false);
  const [newClientError, setNewClientError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch(() => setError("Error al cargar clientes"));
    fetchUsers(true)
      .then(setUsers)
      .catch(() => {});
  }, []);

  const closeNewClientModal = useCallback(() => {
    setShowNewClientModal(false);
    setNewClientError(null);
    setNewClientForm({
      type: "RESIDENCIAL",
      name: "",
      email: "",
      phone: "",
      leadNumber: "",
      salespersonId: "",
    });
  }, []);

  useEffect(() => {
    if (!showNewClientModal) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNewClientModal();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [showNewClientModal, closeNewClientModal]);

  const initialData = isEdit ? props.initial : undefined;
  useEffect(() => {
    if (initialData) {
      setForm({
        clientId: initialData.clientId,
        title: initialData.title,
        projectType: initialData.projectType,
        internalNotes: initialData.internalNotes ?? "",
        clientNotes: initialData.clientNotes ?? "",
        currency: initialData.currency ?? "",
        validUntil: initialData.validUntil ? initialData.validUntil.slice(0, 10) : "",
        paymentTerms: initialData.paymentTerms ?? "",
        deliveryDays: initialData.deliveryDays != null ? String(initialData.deliveryDays) : "",
        commercialStage: initialData.commercialStage ?? "",
        leadNumber: initialData.leadNumber ?? "",
        salespersonId: initialData.salespersonId ?? "",
      });
      if (initialData.quoteKind === "MARGIN") {
        const { unknown, form: mf } = splitMarginTechnicalBasics(initialData.technicalBasicsJson);
        setMarginUnknownJson(unknown);
        setMarginForm(mf);
        setMarginAdvText(JSON.stringify(unknown, null, 2));
        setMarginAdvOpen(false);
      }
    }
  }, [isEdit, initialData]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewClientError(null);
    setNewClientSaving(true);
    try {
      const data: CreateClientInput = {
        type: newClientForm.type,
        name: newClientForm.name.trim(),
        email: newClientForm.email.trim() || undefined,
        phone: newClientForm.phone.trim() || undefined,
      };
      const created = await createClient(data);
      const list = await fetchClients();
      setClients(list);
      setForm((f) => ({
        ...f,
        clientId: created.id,
        leadNumber: newClientForm.leadNumber.trim() || f.leadNumber,
        salespersonId: newClientForm.salespersonId || f.salespersonId,
      }));
      closeNewClientModal();
    } catch (e) {
      setNewClientError(e instanceof Error ? e.message : "Error al crear cliente");
    } finally {
      setNewClientSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let technicalBasicsPatch: { technicalBasicsJson?: Record<string, unknown> } = {};
      if (showMarginTechnicalBasics) {
        let unknown = marginUnknownJson;
        if (marginAdvOpen) {
          const adv = parseMarginAdvancedJson(marginAdvText);
          if (!adv.ok) {
            setError(adv.message);
            setSaving(false);
            return;
          }
          unknown = stripKnownMarginKeys(adv.value);
        }
        const merged = mergeMarginTechnicalBasics(unknown, marginForm);
        technicalBasicsPatch = { technicalBasicsJson: merged };
      }

      if (props.mode === "create") {
        await props.onSubmit({
          clientId: form.clientId.trim(),
          title: form.title.trim(),
          projectType: form.projectType,
          internalNotes: form.internalNotes.trim() || undefined,
          clientNotes: form.clientNotes.trim() || undefined,
          currency: form.currency.trim() || undefined,
          validUntil: form.validUntil || undefined,
          paymentTerms: form.paymentTerms.trim() || undefined,
          deliveryDays: form.deliveryDays !== "" ? Number(form.deliveryDays) : undefined,
          commercialStage: form.commercialStage.trim() || undefined,
          leadNumber: form.leadNumber.trim() || undefined,
          salespersonId: form.salespersonId.trim() || undefined,
          ...technicalBasicsPatch,
        });
      } else {
        await props.onSubmit({
          title: form.title.trim(),
          projectType: form.projectType,
          internalNotes: form.internalNotes.trim() || undefined,
          clientNotes: form.clientNotes.trim() || undefined,
          currency: form.currency.trim() || undefined,
          validUntil: form.validUntil || undefined,
          paymentTerms: form.paymentTerms.trim() || undefined,
          deliveryDays: form.deliveryDays !== "" ? Number(form.deliveryDays) : undefined,
          commercialStage: form.commercialStage.trim() || undefined,
          leadNumber: form.leadNumber.trim() || undefined,
          salespersonId: form.salespersonId.trim() || undefined,
          ...technicalBasicsPatch,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200" role="alert">
          {error}
        </div>
      )}

      {props.mode === "create" && (
        <div>
          <label htmlFor="clientId" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Cliente *
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="clientId"
              required
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className="input-field min-w-0 flex-1"
            >
              <option value="">Seleccione cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewClientModal(true)}
              className="btn-secondary whitespace-nowrap"
            >
              + Nuevo cliente
            </button>
          </div>
          {clients.length === 0 && !showNewClientModal && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Aún no hay clientes. Use <strong>Nuevo cliente</strong> para crear uno sin salir de esta pantalla, o{" "}
              <Link href="/clientes/nuevo" className="text-amber-600 underline hover:no-underline dark:text-amber-400">
                cree uno en Clientes
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {props.mode === "edit" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-500">Cliente</label>
          <p className="text-slate-700 dark:text-slate-300">
            {clients.find((c) => c.id === form.clientId)?.name ?? form.clientId}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="leadNumber" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Número de lead (CRM)
          </label>
          <input
            id="leadNumber"
            type="text"
            value={form.leadNumber}
            onChange={(e) => setForm((f) => ({ ...f, leadNumber: e.target.value }))}
            className="input-field"
            placeholder="Ej. LEAD-001"
          />
        </div>
        <div>
          <label htmlFor="salespersonId" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Vendedor responsable
          </label>
          <select
            id="salespersonId"
            value={form.salespersonId}
            onChange={(e) => setForm((f) => ({ ...f, salespersonId: e.target.value }))}
            className="input-field"
          >
            <option value="">— Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName || u.name || u.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Título *
        </label>
        <input
          id="title"
          type="text"
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="input-field"
          placeholder="Ej. Propuesta FV Casa López"
        />
      </div>

      <div>
        <label htmlFor="projectType" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Tipo de proyecto *
        </label>
        <select
          id="projectType"
          value={form.projectType}
          onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value }))}
          className="input-field"
        >
          {PROJECT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="internalNotes" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Notas internas (opcional)
        </label>
        <textarea
          id="internalNotes"
          rows={2}
          value={form.internalNotes}
          onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
          className="input-field"
        />
      </div>

      <div>
        <label htmlFor="clientNotes" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Notas para cliente (opcional)
        </label>
        <textarea
          id="clientNotes"
          rows={2}
          value={form.clientNotes}
          onChange={(e) => setForm((f) => ({ ...f, clientNotes: e.target.value }))}
          className="input-field"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="currency" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Moneda
          </label>
          <select
            id="currency"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            className="input-field"
          >
            <option value="">—</option>
            <option value="CLP">CLP</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div>
          <label htmlFor="validUntil" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Fecha de validez
          </label>
          <input
            id="validUntil"
            type="date"
            value={form.validUntil}
            onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label htmlFor="paymentTerms" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Condiciones de pago (opcional)
        </label>
        <input
          id="paymentTerms"
          type="text"
          value={form.paymentTerms}
          onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
          className="input-field"
          placeholder="Ej. 30% anticipo, 70% contra entrega"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="deliveryDays" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Plazo de entrega (días)
          </label>
          <input
            id="deliveryDays"
            type="number"
            min={0}
            value={form.deliveryDays}
            onChange={(e) => setForm((f) => ({ ...f, deliveryDays: e.target.value }))}
            className="input-field"
          />
        </div>
        <div>
<label htmlFor="commercialStage" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Etapa comercial (opcional)
        </label>
          <input
            id="commercialStage"
            type="text"
            value={form.commercialStage}
            onChange={(e) => setForm((f) => ({ ...f, commercialStage: e.target.value }))}
            className="input-field"
          />
        </div>
      </div>

      {showMarginTechnicalBasics && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/20">
          <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
            Parámetros técnicos base (margen)
          </h3>
          <p className="mt-1 text-xs text-violet-800/90 dark:text-violet-300/90">
            Estos parámetros son referenciales y complementan la cotización. Los campos vacíos no se guardan.
          </p>

          <div className="mt-4 space-y-4 border-t border-violet-200/80 pt-4 dark:border-violet-800/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">Proyecto</p>
            <div>
              <label htmlFor="margin-referencia" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Referencia de proyecto
              </label>
              <input
                id="margin-referencia"
                type="text"
                value={marginForm.referenciaProyecto}
                onChange={(e) => setMarginForm((m) => ({ ...m, referenciaProyecto: e.target.value }))}
                className="input-field"
                placeholder="Ej. OBRA-2025-041"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="mt-4 space-y-4 border-t border-violet-200/80 pt-4 dark:border-violet-800/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
              Contexto técnico (orientativo)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="margin-system" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tipo de sistema
                </label>
                <select
                  id="margin-system"
                  value={marginForm.systemType}
                  onChange={(e) =>
                    setMarginForm((m) => ({
                      ...m,
                      systemType: e.target.value as MarginTechnicalFormValues["systemType"],
                    }))
                  }
                  className="input-field"
                >
                  <option value="">— Sin especificar</option>
                  {MARGIN_SYSTEM_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="margin-kwp" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Potencia orientativa (kWp)
                </label>
                <input
                  id="margin-kwp"
                  type="text"
                  inputMode="decimal"
                  value={marginForm.potenciaOrientativaKwp}
                  onChange={(e) => setMarginForm((m) => ({ ...m, potenciaOrientativaKwp: e.target.value }))}
                  className="input-field"
                  placeholder="Ej. 12.5"
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label htmlFor="margin-connection" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tipo de conexión
              </label>
              <select
                id="margin-connection"
                value={marginForm.connectionType}
                onChange={(e) =>
                  setMarginForm((m) => ({
                    ...m,
                    connectionType: e.target.value as MarginTechnicalFormValues["connectionType"],
                  }))
                }
                className="input-field max-w-md"
              >
                <option value="">— Sin especificar</option>
                {MARGIN_CONNECTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="margin-mount-structure" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tipo de estructura de montaje
              </label>
              <select
                id="margin-mount-structure"
                value={marginForm.mountStructureType}
                onChange={(e) =>
                  setMarginForm((m) => ({
                    ...m,
                    mountStructureType: e.target.value as MarginTechnicalFormValues["mountStructureType"],
                  }))
                }
                className="input-field max-w-md"
              >
                <option value="">— Sin especificar</option>
                {MARGIN_MOUNT_STRUCTURE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="margin-notas" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Notas de instalación / sitio
              </label>
              <textarea
                id="margin-notas"
                value={marginForm.notasInstalacion}
                onChange={(e) => setMarginForm((m) => ({ ...m, notasInstalacion: e.target.value }))}
                rows={4}
                className="input-field w-full"
                placeholder="Techo, acceso, sombras, etc."
              />
            </div>
          </div>

          <div className="mt-4 border-t border-violet-200/80 pt-4 dark:border-violet-800/60">
            {!marginAdvOpen ? (
              <button
                type="button"
                className="text-sm font-medium text-violet-800 underline hover:no-underline dark:text-violet-300"
                onClick={() => {
                  setMarginAdvText(JSON.stringify(marginUnknownJson, null, 2));
                  setMarginAdvOpen(true);
                }}
              >
                Ver datos técnicos adicionales…
              </button>
            ) : (
              <div className="space-y-2 rounded-md border border-violet-300/80 bg-white/60 p-3 dark:border-violet-800 dark:bg-slate-900/40">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Use este apartado solo si necesita registrar información técnica que no está en el formulario. Al aplicar, se
                  integra con el resto; lo que ya puede editar arriba tiene prioridad.
                </p>
                <textarea
                  value={marginAdvText}
                  onChange={(e) => setMarginAdvText(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  className="input-field w-full font-mono text-sm"
                  aria-label="Editor de datos técnicos adicionales"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() => {
                      const adv = parseMarginAdvancedJson(marginAdvText);
                      if (!adv.ok) {
                        setError(adv.message);
                        return;
                      }
                      setMarginUnknownJson(stripKnownMarginKeys(adv.value));
                      setMarginAdvOpen(false);
                      setError(null);
                    }}
                  >
                    Aplicar y cerrar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() => {
                      setMarginAdvText(JSON.stringify(marginUnknownJson, null, 2));
                      setMarginAdvOpen(false);
                      setError(null);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cotización"}
        </button>
        <Link href="/cotizaciones" className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>

      {showNewClientModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-new-client-title"
          onClick={closeNewClientModal}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="modal-new-client-title" className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Nuevo cliente
            </h3>
            <form onSubmit={handleCreateClient} className="space-y-4">
              {newClientError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200" role="alert">
                  {newClientError}
                </div>
              )}
              <div>
                <label htmlFor="newClientType" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tipo
                </label>
                <select
                  id="newClientType"
                  value={newClientForm.type}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, type: e.target.value }))}
                  className="input-field"
                  required
                >
                  {CLIENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="newClientName" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nombre o razón social *
                </label>
                <input
                  id="newClientName"
                  type="text"
                  value={newClientForm.name}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field"
                  placeholder="Nombre del cliente"
                  required
                />
              </div>
              <div>
                <label htmlFor="newClientEmail" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email (opcional)
                </label>
                <input
                  id="newClientEmail"
                  type="email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, email: e.target.value }))}
                  className="input-field"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <label htmlFor="newClientPhone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Teléfono (opcional)
                </label>
                <input
                  id="newClientPhone"
                  type="text"
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm((f) => ({ ...f, phone: e.target.value }))}
                  className="input-field"
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Contexto comercial del lead (se precargará en la cotización)
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="newClientLeadNumber" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                      Número de lead (CRM)
                    </label>
                    <input
                      id="newClientLeadNumber"
                      type="text"
                      value={newClientForm.leadNumber}
                      onChange={(e) => setNewClientForm((f) => ({ ...f, leadNumber: e.target.value }))}
                      className="input-field"
                      placeholder="Ej. LEAD-001"
                    />
                  </div>
                  <div>
                    <label htmlFor="newClientSalespersonId" className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                      Vendedor responsable
                    </label>
                    <select
                      id="newClientSalespersonId"
                      value={newClientForm.salespersonId}
                      onChange={(e) => setNewClientForm((f) => ({ ...f, salespersonId: e.target.value }))}
                      className="input-field"
                    >
                      <option value="">— Sin asignar</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName || u.name || u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeNewClientModal} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={newClientSaving}>
                  {newClientSaving ? "Creando…" : "Crear cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
