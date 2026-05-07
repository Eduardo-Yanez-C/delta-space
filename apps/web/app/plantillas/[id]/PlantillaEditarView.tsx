"use client";

import { useState, useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type {
  QuoteTemplate,
  QuoteTemplateItem,
  QuoteTemplateLine,
  UpdateQuoteTemplateInput,
  UpdateTemplateItemInput,
  UpdateTemplateLineInput,
} from "../../../lib/api";
import {
  createTemplateItem,
  deleteTemplateItem,
  updateTemplateItem,
  updateTemplateLine,
} from "../../../lib/api";

const SYSTEM_TYPE_OPTIONS = [
  { value: "ON_GRID", label: "On Grid" },
  { value: "OFF_GRID", label: "Off Grid" },
  { value: "HYBRID", label: "Híbrido" },
];

const QUOTE_KIND_LABEL: Record<string, string> = {
  STANDARD: "Estándar",
  MARGIN: "Con margen",
};

/** Modal de líneas de plantilla: portal + header/footer fijos y cuerpo con scroll (todas las plantillas). */
function TemplateLineModalFrame({
  title,
  titleId,
  formId: _formId,
  onClose,
  children,
  footer,
}: {
  title: string;
  titleId: string;
  /** Conservado para alinear footer `form=` con el `<form>` del hijo (accesibilidad). */
  formId: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card flex max-h-[min(90dvh,880px)] w-full max-w-lg flex-col overflow-hidden border border-slate-200 shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h3 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

type Props = {
  template: QuoteTemplate;
  onSaveHeader: (data: UpdateQuoteTemplateInput) => Promise<void>;
  onRefresh: () => void;
};

export function PlantillaEditarView({ template, onSaveHeader, onRefresh }: Props) {
  const [name, setName] = useState(template.name);
  const [systemType, setSystemType] = useState(template.systemType);
  const [targetPowerKwp, setTargetPowerKwp] = useState(String(template.targetPowerKwp ?? ""));
  const [description, setDescription] = useState(template.description ?? "");
  const [saving, setSaving] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [headerSuccess, setHeaderSuccess] = useState<string | null>(null);

  const handleSubmitHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeaderError(null);
    setHeaderSuccess(null);
    setSaving(true);
    try {
      await onSaveHeader({
        name: name.trim(),
        systemType: systemType as "ON_GRID" | "OFF_GRID" | "HYBRID",
        targetPowerKwp: targetPowerKwp.trim() ? Number(targetPowerKwp) : undefined,
        description: description.trim() || undefined,
      });
      setHeaderSuccess("Cabecera guardada.");
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Cabecera de la plantilla</h2>
        <form onSubmit={handleSubmitHeader} className="space-y-4 max-w-xl">
          {headerSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" role="status">
              {headerSuccess}
            </div>
          )}
          {headerError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200" role="alert">
              {headerError}
            </div>
          )}
          <div>
            <label htmlFor="plantilla-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre *
            </label>
            <input
              id="plantilla-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Clase de plantilla</span>
            <div
              id="plantilla-quoteKind"
              className="input-field cursor-not-allowed bg-slate-50 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
              aria-readonly="true"
            >
              {QUOTE_KIND_LABEL[template.quoteKind] ?? QUOTE_KIND_LABEL.STANDARD}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              No se puede cambiar en esta versión. Cree otra plantilla si necesita otra clase.
            </p>
          </div>
          <div>
            <label htmlFor="plantilla-systemType" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tipo de sistema
            </label>
            <select
              id="plantilla-systemType"
              value={systemType}
              onChange={(e) => setSystemType(e.target.value)}
              className="input-field"
            >
              {SYSTEM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="plantilla-targetPowerKwp" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Potencia objetivo (kWp)
            </label>
            <input
              id="plantilla-targetPowerKwp"
              type="number"
              min={0}
              step={0.1}
              value={targetPowerKwp}
              onChange={(e) => setTargetPowerKwp(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="plantilla-description" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Descripción
            </label>
            <textarea
              id="plantilla-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="input-field"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Guardar cabecera"}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Ítems y líneas base</h2>
        <p className="text-sm text-slate-600 mb-4">
          {template.quoteKind === "MARGIN" ? (
            <>
              Cada ítem puede tener varias líneas (manual o desde catálogo). El flujo para crear una cotización con margen desde esta plantilla no está habilitado todavía; use esta sección para preparar la base de ítems.
            </>
          ) : (
            <>
              Cada ítem puede tener varias líneas (manual o desde catálogo). Al crear una cotización estándar desde esta plantilla se generarán estos ítems y líneas.
            </>
          )}
        </p>
        <ItemsAndLinesSection
          templateId={template.id}
          items={template.items ?? []}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}

type ItemsAndLinesSectionProps = {
  templateId: string;
  items: QuoteTemplateItem[];
  onRefresh: () => void;
};

function ItemsAndLinesSection({ templateId, items, onRefresh }: ItemsAndLinesSectionProps) {
  const [adding, setAdding] = useState(false);

  async function handleAddMainBlock() {
    const name = window.prompt("Nombre del bloque principal", "Nuevo bloque");
    if (name === null) return;
    const n = name.trim() || "Nuevo bloque";
    setAdding(true);
    try {
      await createTemplateItem(templateId, { productNameSnapshot: n });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo añadir el bloque");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleAddMainBlock}
          disabled={adding}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {adding ? "Añadiendo…" : "+ Añadir bloque principal"}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm dark:text-slate-400">Esta plantilla no tiene ítems. Use el botón de arriba para crear el primero.</p>
      ) : (
        items.map((item) => (
          <ItemBlock
            key={item.id}
            templateId={templateId}
            item={item}
            onRefresh={onRefresh}
          />
        ))
      )}
    </div>
  );
}

type ItemBlockProps = {
  templateId: string;
  item: QuoteTemplateItem;
  onRefresh: () => void;
};

function ItemBlock({ templateId, item, onRefresh }: ItemBlockProps) {
  const [showEditBlock, setShowEditBlock] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lines = item.lines ?? [];
  const blockVisible = item.visibleInFinalQuoteDefault !== false;

  async function handleDeleteBlock() {
    if (
      !window.confirm(
        "¿Eliminar este bloque principal y todas sus líneas de la plantilla? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteTemplateItem(templateId, item.id);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar el bloque");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-700/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium text-slate-800 dark:text-slate-100">
            {item.productNameSnapshot || `Ítem ${item.sortOrder + 1}`}
          </div>
          {item.productDescriptionSnapshot && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{item.productDescriptionSnapshot}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={() => setShowEditBlock(true)}
            className="btn-secondary text-sm"
          >
            Editar bloque
          </button>
          <button
            type="button"
            onClick={handleDeleteBlock}
            disabled={deleting}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950/80"
          >
            {deleting ? "Eliminando…" : "Eliminar bloque"}
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Cantidad: {item.quantityRule === "FIXED" ? item.quantityFixed ?? "—" : "Derivada de potencia"}
        {item.unitPriceDefault != null && ` · Precio ref: ${item.unitPriceDefault}`}
        {" · "}
        Bloque en PDF: {blockVisible ? "sí" : "no"}
      </div>
      {showEditBlock && (
        <ModalEditarBloquePlantilla
          templateId={templateId}
          item={item}
          onClose={() => setShowEditBlock(false)}
          onSaved={() => {
            setShowEditBlock(false);
            onRefresh();
          }}
        />
      )}
      {lines.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Líneas base</div>
          <ul className="space-y-2">
            {lines.map((line) => (
              <LineRow
                key={line.id}
                templateId={templateId}
                line={line}
                onRefresh={onRefresh}
              />
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <AddLineButtons templateId={templateId} itemId={item.id} onRefresh={onRefresh} />
          </div>
        </div>
      )}
      {lines.length === 0 && (
        <div className="mt-3 rounded border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-400">
          <p className="mb-2">Este ítem no tiene líneas base. Agregue una línea manual o desde catálogo.</p>
          <AddLineButtons templateId={templateId} itemId={item.id} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  );
}

type ModalEditarBloquePlantillaProps = {
  templateId: string;
  item: QuoteTemplateItem;
  onClose: () => void;
  onSaved: () => void;
};

function ModalEditarBloquePlantilla({
  templateId,
  item,
  onClose,
  onSaved,
}: ModalEditarBloquePlantillaProps) {
  const formId = useId().replace(/:/g, "");
  const titleId = `${formId}-edit-block-title`;
  const [productNameSnapshot, setProductNameSnapshot] = useState(item.productNameSnapshot ?? "");
  const [productDescriptionSnapshot, setProductDescriptionSnapshot] = useState(
    item.productDescriptionSnapshot ?? "",
  );
  const [visibleInFinalQuoteDefault, setVisibleInFinalQuoteDefault] = useState(
    item.visibleInFinalQuoteDefault !== false,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProductNameSnapshot(item.productNameSnapshot ?? "");
    setProductDescriptionSnapshot(item.productDescriptionSnapshot ?? "");
    setVisibleInFinalQuoteDefault(item.visibleInFinalQuoteDefault !== false);
    setError(null);
  }, [item.id, item.productNameSnapshot, item.productDescriptionSnapshot, item.visibleInFinalQuoteDefault]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const patch: UpdateTemplateItemInput = {
        productNameSnapshot: productNameSnapshot.trim(),
        productDescriptionSnapshot:
          productDescriptionSnapshot.trim() === "" ? null : productDescriptionSnapshot.trim(),
        visibleInFinalQuoteDefault,
      };
      await updateTemplateItem(templateId, item.id, patch);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TemplateLineModalFrame
      title="Editar bloque"
      titleId={titleId}
      formId={formId}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" form={formId} disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
          <input
            type="text"
            value={productNameSnapshot}
            onChange={(e) => setProductNameSnapshot(e.target.value)}
            className="input-field w-full"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
          <textarea
            value={productDescriptionSnapshot}
            onChange={(e) => setProductDescriptionSnapshot(e.target.value)}
            rows={3}
            className="input-field w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`block-visible-${formId}`}
            checked={visibleInFinalQuoteDefault}
            onChange={(e) => setVisibleInFinalQuoteDefault(e.target.checked)}
          />
          <label htmlFor={`block-visible-${formId}`} className="text-sm text-slate-700 dark:text-slate-300">
            Visible en cotización final / PDF
          </label>
        </div>
      </form>
    </TemplateLineModalFrame>
  );
}

type LineRowProps = {
  templateId: string;
  line: QuoteTemplateLine;
  onRefresh: () => void;
};

function normTemplatePrice(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/** Edición rápida: precio, moneda y visibilidad en PDF (STANDARD y MARGIN). */
function LineQuickEdit({
  templateId,
  line,
  onRefresh,
}: {
  templateId: string;
  line: QuoteTemplateLine;
  onRefresh: () => void;
}) {
  const [price, setPrice] = useState(String(line.unitPriceDefault ?? ""));
  const [curr, setCurr] = useState(line.currency ?? "");
  const [vis, setVis] = useState(Boolean(line.visibleInFinalQuoteDefault));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrice(String(line.unitPriceDefault ?? ""));
    setCurr(line.currency ?? "");
    setVis(Boolean(line.visibleInFinalQuoteDefault));
    setError(null);
  }, [line.id, line.unitPriceDefault, line.currency, line.visibleInFinalQuoteDefault]);

  const applyQuickPatch = async () => {
    const patch: UpdateTemplateLineInput = {};
    const draftPrice = price.trim() === "" ? 0 : Number(price);
    if (!Number.isFinite(draftPrice)) {
      setError("Precio no válido.");
      return;
    }
    if (draftPrice !== normTemplatePrice(line.unitPriceDefault)) {
      patch.unitPriceDefault = draftPrice;
    }
    const draftCurr = curr.trim();
    const lineCurr = (line.currency ?? "").trim();
    if (draftCurr !== lineCurr) {
      patch.currency = draftCurr || undefined;
    }
    if (vis !== Boolean(line.visibleInFinalQuoteDefault)) {
      patch.visibleInFinalQuoteDefault = vis;
    }
    if (Object.keys(patch).length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await updateTemplateLine(templateId, line.id, patch);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/50">
      <div className="mb-1 text-xs font-medium text-slate-700 dark:text-slate-200">Edición rápida</div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[6rem]">
          <label className="mb-0.5 block text-xs text-slate-600 dark:text-slate-400">Precio ref.</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input-field w-full py-1.5 text-sm"
            disabled={saving}
          />
        </div>
        <div className="min-w-[4.5rem]">
          <label className="mb-0.5 block text-xs text-slate-600 dark:text-slate-400">Moneda</label>
          <input
            type="text"
            value={curr}
            onChange={(e) => setCurr(e.target.value)}
            placeholder="CLP"
            className="input-field w-full py-1.5 text-sm"
            disabled={saving}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 pb-1 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={vis}
            onChange={(e) => setVis(e.target.checked)}
            disabled={saving}
          />
          Visible en cotización final / PDF
        </label>
        <button
          type="button"
          className="btn-secondary py-1.5 text-sm"
          disabled={saving}
          onClick={() => void applyQuickPatch()}
        >
          {saving ? "Guardando…" : "Aplicar cambios"}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function LineRow({ templateId, line, onRefresh }: LineRowProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const label = line.productNameSnapshot ?? line.product?.name ?? "Línea";
  return (
    <li className="rounded bg-white px-3 py-2 text-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="text-slate-800 dark:text-slate-100">{label}</span>
          {line.source === "FROM_CATALOG" && (
            <span className="ml-2 text-xs text-slate-500">(catálogo)</span>
          )}
          <span className="ml-2 text-slate-500 dark:text-slate-400">
            · Cant: {line.quantityRule === "FIXED" ? line.quantityFixed ?? "—" : "derivada"}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="text-slate-600 hover:text-slate-800 text-sm font-medium"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm("¿Eliminar esta línea de la plantilla? Esta acción no se puede deshacer.")) return;
              setDeleting(true);
              try {
                const { deleteTemplateLine } = await import("../../../lib/api");
                await deleteTemplateLine(templateId, line.id);
                onRefresh();
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
          >
            {deleting ? "…" : "Eliminar"}
          </button>
        </div>
      </div>
      <LineQuickEdit templateId={templateId} line={line} onRefresh={onRefresh} />
      {showEdit && (
        <ModalEditarLineaPlantilla
          templateId={templateId}
          line={line}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            onRefresh();
          }}
        />
      )}
    </li>
  );
}

type AddLineButtonsProps = {
  templateId: string;
  itemId: string;
  onRefresh: () => void;
};

function AddLineButtons({ templateId, itemId, onRefresh }: AddLineButtonsProps) {
  const [showManual, setShowManual] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShowManual(true)}
        className="btn-secondary text-sm"
      >
        + Línea manual
      </button>
      <button
        type="button"
        onClick={() => setShowCatalog(true)}
        className="btn-secondary text-sm"
      >
        + Línea desde catálogo
      </button>
      {showManual && (
        <ModalNuevaLineaManual
          templateId={templateId}
          itemId={itemId}
          onClose={() => setShowManual(false)}
          onSaved={() => { setShowManual(false); onRefresh(); }}
        />
      )}
      {showCatalog && (
        <ModalNuevaLineaCatalogo
          templateId={templateId}
          itemId={itemId}
          onClose={() => setShowCatalog(false)}
          onSaved={() => { setShowCatalog(false); onRefresh(); }}
        />
      )}
    </>
  );
}

type ModalEditarLineaPlantillaProps = {
  templateId: string;
  line: QuoteTemplateLine;
  onClose: () => void;
  onSaved: () => void;
};

function ModalEditarLineaPlantilla({
  templateId,
  line,
  onClose,
  onSaved,
}: ModalEditarLineaPlantillaProps) {
  const formId = useId().replace(/:/g, "");
  const titleId = `${formId}-edit-line-title`;
  const [productNameSnapshot, setProductNameSnapshot] = useState(line.productNameSnapshot ?? "");
  const [productDescriptionSnapshot, setProductDescriptionSnapshot] = useState(line.productDescriptionSnapshot ?? "");
  const [quantityRule, setQuantityRule] = useState<"FIXED" | "DERIVED_FROM_POWER">(line.quantityRule as "FIXED" | "DERIVED_FROM_POWER");
  const [quantityFixed, setQuantityFixed] = useState(String(line.quantityFixed ?? ""));
  const [potenciaPorPanelWp, setPotenciaPorPanelWp] = useState(String(line.potenciaPorPanelWp ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const structural: UpdateTemplateLineInput = {
        productNameSnapshot: productNameSnapshot.trim() || undefined,
        productDescriptionSnapshot: productDescriptionSnapshot.trim() || undefined,
        quantityRule,
        quantityFixed: quantityRule === "FIXED" && quantityFixed.trim() ? Number(quantityFixed) : undefined,
        potenciaPorPanelWp:
          quantityRule === "DERIVED_FROM_POWER" && potenciaPorPanelWp.trim()
            ? Number(potenciaPorPanelWp)
            : undefined,
      };
      await updateTemplateLine(templateId, line.id, structural);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TemplateLineModalFrame
      title="Editar línea"
      titleId={titleId}
      formId={formId}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" form={formId} disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
          <input
            type="text"
            value={productNameSnapshot}
            onChange={(e) => setProductNameSnapshot(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
          <textarea
            value={productDescriptionSnapshot}
            onChange={(e) => setProductDescriptionSnapshot(e.target.value)}
            rows={2}
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Regla de cantidad</label>
          <select
            value={quantityRule}
            onChange={(e) => setQuantityRule(e.target.value as "FIXED" | "DERIVED_FROM_POWER")}
            className="input-field w-full"
          >
            <option value="FIXED">Fija</option>
            <option value="DERIVED_FROM_POWER">Derivada de potencia</option>
          </select>
        </div>
        {quantityRule === "FIXED" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad fija</label>
            <input
              type="number"
              min={0}
              value={quantityFixed}
              onChange={(e) => setQuantityFixed(e.target.value)}
              className="input-field w-full"
            />
          </div>
        )}
        {quantityRule === "DERIVED_FROM_POWER" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Potencia por panel (Wp)
            </label>
            <input
              type="number"
              min={1}
              value={potenciaPorPanelWp}
              onChange={(e) => setPotenciaPorPanelWp(e.target.value)}
              className="input-field w-full"
            />
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Precio unitario por defecto, moneda y visibilidad en cotización final / PDF se editan en la sección
          &quot;Edición rápida&quot; de esta línea.
        </p>
      </form>
    </TemplateLineModalFrame>
  );
}

type ModalNuevaLineaManualProps = {
  templateId: string;
  itemId: string;
  onClose: () => void;
  onSaved: () => void;
};

function ModalNuevaLineaManual({ templateId, itemId, onClose, onSaved }: ModalNuevaLineaManualProps) {
  const formId = useId().replace(/:/g, "");
  const titleId = `${formId}-nueva-manual-title`;
  const [productNameSnapshot, setProductNameSnapshot] = useState("");
  const [productDescriptionSnapshot, setProductDescriptionSnapshot] = useState("");
  const [quantityRule, setQuantityRule] = useState<"FIXED" | "DERIVED_FROM_POWER">("FIXED");
  const [quantityFixed, setQuantityFixed] = useState("1");
  const [potenciaPorPanelWp, setPotenciaPorPanelWp] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productNameSnapshot.trim()) {
      setError("El nombre es obligatorio para línea manual.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { createTemplateLine } = await import("../../../lib/api");
      await createTemplateLine(templateId, itemId, {
        source: "MANUAL",
        productNameSnapshot: productNameSnapshot.trim(),
        productDescriptionSnapshot: productDescriptionSnapshot.trim() || undefined,
        quantityRule,
        quantityFixed: quantityRule === "FIXED" && quantityFixed.trim() ? Number(quantityFixed) : undefined,
        potenciaPorPanelWp: quantityRule === "DERIVED_FROM_POWER" && potenciaPorPanelWp.trim() ? Number(potenciaPorPanelWp) : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear línea");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TemplateLineModalFrame
      title="Añadir línea manual"
      titleId={titleId}
      formId={formId}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" form={formId} disabled={saving} className="btn-primary">
            {saving ? "Creando…" : "Crear línea"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre *</label>
          <input
            type="text"
            value={productNameSnapshot}
            onChange={(e) => setProductNameSnapshot(e.target.value)}
            className="input-field w-full"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
          <textarea
            value={productDescriptionSnapshot}
            onChange={(e) => setProductDescriptionSnapshot(e.target.value)}
            rows={2}
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Regla de cantidad</label>
          <select
            value={quantityRule}
            onChange={(e) => setQuantityRule(e.target.value as "FIXED" | "DERIVED_FROM_POWER")}
            className="input-field w-full"
          >
            <option value="FIXED">Fija</option>
            <option value="DERIVED_FROM_POWER">Derivada de potencia</option>
          </select>
        </div>
        {quantityRule === "FIXED" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad fija</label>
            <input
              type="number"
              min={0}
              value={quantityFixed}
              onChange={(e) => setQuantityFixed(e.target.value)}
              className="input-field w-full"
            />
          </div>
        )}
        {quantityRule === "DERIVED_FROM_POWER" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Potencia por panel (Wp)
            </label>
            <input
              type="number"
              min={1}
              value={potenciaPorPanelWp}
              onChange={(e) => setPotenciaPorPanelWp(e.target.value)}
              className="input-field w-full"
            />
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tras crear la línea, use &quot;Edición rápida&quot; en la fila para precio por defecto, moneda y visibilidad en
          PDF.
        </p>
      </form>
    </TemplateLineModalFrame>
  );
}

type ModalNuevaLineaCatalogoProps = {
  templateId: string;
  itemId: string;
  onClose: () => void;
  onSaved: () => void;
};

function ModalNuevaLineaCatalogo({ templateId, itemId, onClose, onSaved }: ModalNuevaLineaCatalogoProps) {
  const formId = useId().replace(/:/g, "");
  const titleId = `${formId}-nueva-catalogo-title`;
  const [products, setProducts] = useState<Array<{ id: string; name: string; description: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [quantityRule, setQuantityRule] = useState<"FIXED" | "DERIVED_FROM_POWER">("FIXED");
  const [quantityFixed, setQuantityFixed] = useState("1");
  const [potenciaPorPanelWp, setPotenciaPorPanelWp] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("../../../lib/api").then(({ fetchProducts }) =>
      fetchProducts()
        .then((data) => {
          if (!cancelled) setProducts(data.map((p) => ({ id: p.id, name: p.name, description: p.description })));
        })
        .catch(() => { if (!cancelled) setError("Error al cargar productos"); })
        .finally(() => { if (!cancelled) setLoading(false); })
    );
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId.trim()) {
      setError("Seleccione un producto del catálogo.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { createTemplateLine } = await import("../../../lib/api");
      await createTemplateLine(templateId, itemId, {
        source: "FROM_CATALOG",
        productId: productId.trim(),
        quantityRule,
        quantityFixed: quantityRule === "FIXED" && quantityFixed.trim() ? Number(quantityFixed) : undefined,
        potenciaPorPanelWp: quantityRule === "DERIVED_FROM_POWER" && potenciaPorPanelWp.trim() ? Number(potenciaPorPanelWp) : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear línea");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TemplateLineModalFrame
      title="Añadir línea desde catálogo"
      titleId={titleId}
      formId={formId}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" form={formId} disabled={saving || loading} className="btn-primary">
            {saving ? "Creando…" : "Crear línea"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Producto *</label>
          {loading ? (
            <span className="text-sm text-slate-500">Cargando productos…</span>
          ) : (
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="input-field w-full"
              required
            >
              <option value="">Seleccione producto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Regla de cantidad</label>
          <select
            value={quantityRule}
            onChange={(e) => setQuantityRule(e.target.value as "FIXED" | "DERIVED_FROM_POWER")}
            className="input-field w-full"
          >
            <option value="FIXED">Fija</option>
            <option value="DERIVED_FROM_POWER">Derivada de potencia</option>
          </select>
        </div>
        {quantityRule === "FIXED" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad fija</label>
            <input
              type="number"
              min={0}
              value={quantityFixed}
              onChange={(e) => setQuantityFixed(e.target.value)}
              className="input-field w-full"
            />
          </div>
        )}
        {quantityRule === "DERIVED_FROM_POWER" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Potencia por panel (Wp)
            </label>
            <input
              type="number"
              min={1}
              value={potenciaPorPanelWp}
              onChange={(e) => setPotenciaPorPanelWp(e.target.value)}
              className="input-field w-full"
            />
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tras crear la línea, use &quot;Edición rápida&quot; en la fila para precio por defecto, moneda y visibilidad en
          PDF.
        </p>
      </form>
    </TemplateLineModalFrame>
  );
}
