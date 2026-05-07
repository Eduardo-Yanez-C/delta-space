"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  fetchCategories,
  fetchBrands,
  fetchProductModels,
  fetchSuppliers,
  type Product,
  type CreateProductInput,
  type UpdateProductInput,
  type Category,
  type Brand,
  type ProductModel,
  type Supplier,
} from "../../lib/api";

const COMMERCIAL_STATUS = [
  { value: "ACTIVO", label: "Activo" },
  { value: "DESCONTINUADO", label: "Descontinuado" },
  { value: "BAJO_REVISION", label: "En revisión" },
];

const PANEL_SLUGS = ["paneles-fotovoltaicos"];
const INVERTER_SLUGS = ["inversores-on-grid", "inversores-hibridos", "inversores-off-grid"];
const BATTERY_SLUG = "baterias";
function getSpecKind(slug: string | undefined): "panel" | "inverter" | "battery" | null {
  if (!slug) return null;
  if (PANEL_SLUGS.includes(slug)) return "panel";
  if (INVERTER_SLUGS.includes(slug)) return "inverter";
  if (slug === BATTERY_SLUG) return "battery";
  return null;
}

function toNum(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && !Number.isNaN(n) ? n : undefined;
}

type Props =
  | { mode: "create"; onSubmit: (data: CreateProductInput) => Promise<void> }
  | { mode: "edit"; initial: Product; onSubmit: (data: UpdateProductInput) => Promise<void> };

export function ProductForm(props: Props) {
  const isEdit = props.mode === "edit";
  const emptyPanel = () => ({ powerW: "", efficiencyPercent: "", vmpV: "", impA: "", vocV: "", iscA: "", bifacialityPercent: "", cellType: "", lengthMm: "", widthMm: "", heightMm: "", weightKg: "" });
const emptyInverter = () => ({ inverterType: "", powerAcW: "", maxPvVoltageV: "", startupVoltageV: "", mpptVoltageMinV: "", mpptVoltageMaxV: "", maxDcCurrentA: "", efficiencyPercent: "", connectionType: "", ipRating: "", communication: "" });
const emptyBattery = () => ({ capacityKwh: "", nominalVoltageV: "", maxChargeDischargePowerW: "", chemistry: "", cycles: "", weightKg: "", dimensionsMm: "" });

const initial = isEdit
    ? {
        internalCode: props.initial.internalCode ?? "",
        sku: props.initial.sku ?? "",
        categoryId: String(props.initial.categoryId),
        brandId: props.initial.brandNameFree ? "manual" : String(props.initial.brandId ?? ""),
        brandNameFree: props.initial.brandNameFree ?? "",
        modelId: props.initial.modelNameFree ? "manual" : String(props.initial.modelId ?? ""),
        modelNameFree: props.initial.modelNameFree ?? "",
        name: props.initial.name,
        description: props.initial.description ?? "",
        unit: props.initial.unit,
        purchaseUnit: props.initial.purchaseUnit ?? "",
        technicalSheetUrl: props.initial.technicalSheetUrl ?? "",
        realManufacturer: props.initial.realManufacturer ?? "",
        commercialStatus: props.initial.commercialStatus,
        defaultCurrency: props.initial.defaultCurrency ?? "",
        warranty: props.initial.warranty ?? "",
        leadTimeDays: props.initial.leadTimeDays != null ? String(props.initial.leadTimeDays) : "",
        stockReference: props.initial.stockReference ?? "",
        origin: props.initial.origin ?? "",
        internalNotes: props.initial.internalNotes ?? "",
        primarySupplierId: props.initial.primarySupplierId ?? "",
        panelSpecs: props.initial.panelSpecs ? { powerW: String(props.initial.panelSpecs.powerW ?? ""), efficiencyPercent: String(props.initial.panelSpecs.efficiencyPercent ?? ""), vmpV: String(props.initial.panelSpecs.vmpV ?? ""), impA: String(props.initial.panelSpecs.impA ?? ""), vocV: String(props.initial.panelSpecs.vocV ?? ""), iscA: String(props.initial.panelSpecs.iscA ?? ""), bifacialityPercent: String(props.initial.panelSpecs.bifacialityPercent ?? ""), cellType: props.initial.panelSpecs.cellType ?? "", lengthMm: String(props.initial.panelSpecs.lengthMm ?? ""), widthMm: String(props.initial.panelSpecs.widthMm ?? ""), heightMm: String(props.initial.panelSpecs.heightMm ?? ""), weightKg: String(props.initial.panelSpecs.weightKg ?? "") } : emptyPanel(),
        inverterSpecs: props.initial.inverterSpecs ? { inverterType: props.initial.inverterSpecs.inverterType ?? "", powerAcW: String(props.initial.inverterSpecs.powerAcW ?? ""), maxPvVoltageV: String(props.initial.inverterSpecs.maxPvVoltageV ?? ""), startupVoltageV: String(props.initial.inverterSpecs.startupVoltageV ?? ""), mpptVoltageMinV: String(props.initial.inverterSpecs.mpptVoltageMinV ?? ""), mpptVoltageMaxV: String(props.initial.inverterSpecs.mpptVoltageMaxV ?? ""), maxDcCurrentA: String(props.initial.inverterSpecs.maxDcCurrentA ?? ""), efficiencyPercent: String(props.initial.inverterSpecs.efficiencyPercent ?? ""), connectionType: props.initial.inverterSpecs.connectionType ?? "", ipRating: props.initial.inverterSpecs.ipRating ?? "", communication: props.initial.inverterSpecs.communication ?? "" } : emptyInverter(),
        batterySpecs: props.initial.batterySpecs ? { capacityKwh: String(props.initial.batterySpecs.capacityKwh ?? ""), nominalVoltageV: String(props.initial.batterySpecs.nominalVoltageV ?? ""), maxChargeDischargePowerW: String(props.initial.batterySpecs.maxChargeDischargePowerW ?? ""), chemistry: props.initial.batterySpecs.chemistry ?? "", cycles: String(props.initial.batterySpecs.cycles ?? ""), weightKg: String(props.initial.batterySpecs.weightKg ?? ""), dimensionsMm: props.initial.batterySpecs.dimensionsMm ?? "" } : emptyBattery(),
      }
    : {
        internalCode: "",
        sku: "",
        categoryId: "",
        brandId: "",
        brandNameFree: "",
        modelId: "",
        modelNameFree: "",
        name: "",
        description: "",
        unit: "unidad",
        purchaseUnit: "",
        technicalSheetUrl: "",
        realManufacturer: "",
        commercialStatus: "ACTIVO",
        defaultCurrency: "CLP",
        warranty: "",
        leadTimeDays: "",
        stockReference: "",
        origin: "",
        internalNotes: "",
        primarySupplierId: "",
        panelSpecs: emptyPanel(),
        inverterSpecs: emptyInverter(),
        batterySpecs: emptyBattery(),
      };

  const [form, setForm] = useState(initial);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Última marca elegida; evita aplicar respuestas viejas de /product-models al cambiar de marca rápido. */
  const brandIdLatestRef = useRef(form.brandId);
  brandIdLatestRef.current = form.brandId;

  useEffect(() => {
    Promise.all([fetchCategories(), fetchBrands(), fetchSuppliers()])
      .then(([c, b, s]) => {
        setCategories(c);
        setBrands(b);
        setSuppliers(s.filter((x) => x.active));
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Error al cargar catálogo";
        setError(msg);
      });
  }, []);

  useEffect(() => {
    const brandKey = form.brandId;
    const parsed =
      brandKey && brandKey !== "manual" ? Number(brandKey) : undefined;
    const brandIdNum =
      parsed != null && !Number.isNaN(parsed) ? parsed : undefined;

    if (!brandIdNum) {
      setModels([]);
      setForm((f) => ({ ...f, modelId: f.modelId === "manual" ? f.modelId : "" }));
      return;
    }

    const ac = new AbortController();
    fetchProductModels(brandIdNum, ac.signal)
      .then((data) => {
        if (brandIdLatestRef.current !== brandKey) return;
        setModels(data);
        setForm((f) => {
          if (f.brandId !== brandKey) return f;
          const currentModelId = f.modelId && f.modelId !== "manual" ? Number(f.modelId) : null;
          const stillValid = currentModelId && data.some((m) => m.id === currentModelId);
          return { ...f, modelId: stillValid ? String(f.modelId) : "" };
        });
      })
      .catch((e: unknown) => {
        if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "AbortError") return;
        if (brandIdLatestRef.current !== brandKey) return;
        setModels([]);
        setForm((f) =>
          f.brandId !== brandKey ? f : { ...f, modelId: f.modelId === "manual" ? f.modelId : "" },
        );
      });

    return () => ac.abort();
  }, [form.brandId]);

  const categorySlug = categories.find((c) => c.id === Number(form.categoryId))?.slug;
  const specKind = getSpecKind(categorySlug);

  const buildPanelPayload = () => {
    const p = form.panelSpecs!;
    const out: CreateProductInput["panelSpecs"] = {};
    if (toNum(p.powerW) != null) out.powerW = toNum(p.powerW)!;
    if (toNum(p.efficiencyPercent) != null) out.efficiencyPercent = toNum(p.efficiencyPercent)!;
    if (toNum(p.vmpV) != null) out.vmpV = toNum(p.vmpV)!;
    if (toNum(p.impA) != null) out.impA = toNum(p.impA)!;
    if (toNum(p.vocV) != null) out.vocV = toNum(p.vocV)!;
    if (toNum(p.iscA) != null) out.iscA = toNum(p.iscA)!;
    if (toNum(p.bifacialityPercent) != null) out.bifacialityPercent = toNum(p.bifacialityPercent)!;
    if (p.cellType?.trim()) out.cellType = p.cellType.trim();
    if (toNum(p.lengthMm) != null) out.lengthMm = toNum(p.lengthMm)!;
    if (toNum(p.widthMm) != null) out.widthMm = toNum(p.widthMm)!;
    if (toNum(p.heightMm) != null) out.heightMm = toNum(p.heightMm)!;
    if (toNum(p.weightKg) != null) out.weightKg = toNum(p.weightKg)!;
    return Object.keys(out).length ? out : null;
  };
  const buildInverterPayload = () => {
    const p = form.inverterSpecs!;
    const out: CreateProductInput["inverterSpecs"] = {};
    if (p.inverterType?.trim()) out.inverterType = p.inverterType.trim();
    if (toNum(p.powerAcW) != null) out.powerAcW = toNum(p.powerAcW)!;
    if (toNum(p.maxPvVoltageV) != null) out.maxPvVoltageV = toNum(p.maxPvVoltageV)!;
    if (toNum(p.startupVoltageV) != null) out.startupVoltageV = toNum(p.startupVoltageV)!;
    if (toNum(p.mpptVoltageMinV) != null) out.mpptVoltageMinV = toNum(p.mpptVoltageMinV)!;
    if (toNum(p.mpptVoltageMaxV) != null) out.mpptVoltageMaxV = toNum(p.mpptVoltageMaxV)!;
    if (toNum(p.maxDcCurrentA) != null) out.maxDcCurrentA = toNum(p.maxDcCurrentA)!;
    if (toNum(p.efficiencyPercent) != null) out.efficiencyPercent = toNum(p.efficiencyPercent)!;
    if (p.connectionType?.trim()) out.connectionType = p.connectionType.trim();
    if (p.ipRating?.trim()) out.ipRating = p.ipRating.trim();
    if (p.communication?.trim()) out.communication = p.communication.trim();
    return Object.keys(out).length ? out : null;
  };
  const buildBatteryPayload = () => {
    const p = form.batterySpecs!;
    const out: CreateProductInput["batterySpecs"] = {};
    if (toNum(p.capacityKwh) != null) out.capacityKwh = toNum(p.capacityKwh)!;
    if (toNum(p.nominalVoltageV) != null) out.nominalVoltageV = toNum(p.nominalVoltageV)!;
    if (toNum(p.maxChargeDischargePowerW) != null) out.maxChargeDischargePowerW = toNum(p.maxChargeDischargePowerW)!;
    if (p.chemistry?.trim()) out.chemistry = p.chemistry.trim();
    if (toNum(p.cycles) != null) out.cycles = toNum(p.cycles)!;
    if (toNum(p.weightKg) != null) out.weightKg = toNum(p.weightKg)!;
    if (p.dimensionsMm?.trim()) out.dimensionsMm = p.dimensionsMm.trim();
    return Object.keys(out).length ? out : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const brandPayload =
        form.brandId === "manual"
          ? { brandId: undefined as number | undefined, brandNameFree: form.brandNameFree.trim() || undefined }
          : {
              brandId: form.brandId ? Number(form.brandId) : undefined,
              brandNameFree: isEdit ? null : undefined,
            };
      const modelPayload =
        form.brandId === "manual"
          ? {
              modelId: undefined as number | undefined,
              modelNameFree: form.modelNameFree.trim() || undefined,
            }
          : form.modelId === "manual"
            ? {
                modelId: undefined as number | undefined,
                modelNameFree: form.modelNameFree.trim() || undefined,
              }
            : {
                modelId: form.modelId && form.modelId !== "manual" ? Number(form.modelId) : undefined,
                modelNameFree: isEdit ? null : undefined,
              };
      const payload: CreateProductInput | UpdateProductInput = {
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        unit: form.unit.trim(),
        internalCode: form.internalCode.trim() || undefined,
        sku: form.sku.trim() || undefined,
        description: form.description.trim() || undefined,
        purchaseUnit: form.purchaseUnit.trim() || undefined,
        technicalSheetUrl: form.technicalSheetUrl.trim() || undefined,
        realManufacturer: form.realManufacturer.trim() || undefined,
        commercialStatus: form.commercialStatus,
        defaultCurrency: form.defaultCurrency.trim() || undefined,
        warranty: form.warranty.trim() || undefined,
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
        stockReference: form.stockReference.trim() || undefined,
        origin: form.origin.trim() || undefined,
        internalNotes: form.internalNotes.trim() || undefined,
        ...brandPayload,
        ...modelPayload,
        primarySupplierId: form.primarySupplierId || undefined,
      };
      if (isEdit && "primarySupplierId" in payload) {
        (payload as UpdateProductInput).primarySupplierId = form.primarySupplierId?.trim() || undefined;
      }
      if (specKind === "panel") {
        const built = buildPanelPayload();
        if (isEdit) {
          (payload as UpdateProductInput).panelSpecs = built;
          (payload as UpdateProductInput).inverterSpecs = null;
          (payload as UpdateProductInput).batterySpecs = null;
        } else if (built) (payload as CreateProductInput).panelSpecs = built;
      } else if (specKind === "inverter") {
        const built = buildInverterPayload();
        if (isEdit) {
          (payload as UpdateProductInput).inverterSpecs = built;
          (payload as UpdateProductInput).panelSpecs = null;
          (payload as UpdateProductInput).batterySpecs = null;
        } else if (built) (payload as CreateProductInput).inverterSpecs = built;
      } else if (specKind === "battery") {
        const built = buildBatteryPayload();
        if (isEdit) {
          (payload as UpdateProductInput).batterySpecs = built;
          (payload as UpdateProductInput).panelSpecs = null;
          (payload as UpdateProductInput).inverterSpecs = null;
        } else if (built) (payload as CreateProductInput).batterySpecs = built;
      }
      await props.onSubmit(payload as CreateProductInput & UpdateProductInput);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Código interno</label>
          <input
            type="text"
            value={form.internalCode}
            onChange={(e) => setForm((f) => ({ ...f, internalCode: e.target.value }))}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">SKU</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            className="input-field"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Categoría *</label>
        <select
          value={form.categoryId}
          onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          className="input-field"
          required
        >
<option value="">Seleccione categoría</option>
            {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Marca</label>
          <select
            value={form.brandId}
            onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value, brandNameFree: e.target.value === "manual" ? f.brandNameFree : "" }))}
            className="input-field"
          >
            <option value="">Ninguna</option>
            <option value="manual">Ingresar manualmente</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {form.brandId === "manual" && (
            <input
              type="text"
              value={form.brandNameFree}
              onChange={(e) => setForm((f) => ({ ...f, brandNameFree: e.target.value }))}
              className="input-field mt-2"
              placeholder="Nombre de la marca"
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Modelo</label>
          {form.brandId === "manual" ? (
            <input
              type="text"
              value={form.modelNameFree}
              onChange={(e) => setForm((f) => ({ ...f, modelNameFree: e.target.value }))}
              className="input-field"
              placeholder="Nombre del modelo"
            />
          ) : (
            <>
              <select
                value={form.modelId}
                onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value, modelNameFree: e.target.value === "manual" ? f.modelNameFree : "" }))}
                className="input-field"
                disabled={!form.brandId}
              >
                <option value="">Ninguno</option>
                <option value="manual">Ingresar manualmente</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {form.modelId === "manual" && (
                <input
                  type="text"
                  value={form.modelNameFree}
                  onChange={(e) => setForm((f) => ({ ...f, modelNameFree: e.target.value }))}
                  className="input-field mt-2"
                  placeholder="Nombre del modelo"
                />
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre comercial *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="input-field"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción técnica</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="input-field"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Unidad de venta *</label>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="input-field"
            placeholder="Ej. unidad, juego, kWp"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Unidad de compra</label>
          <input
            type="text"
            value={form.purchaseUnit}
            onChange={(e) => setForm((f) => ({ ...f, purchaseUnit: e.target.value }))}
            className="input-field"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">URL ficha técnica</label>
        <input
          type="url"
          value={form.technicalSheetUrl}
          onChange={(e) => setForm((f) => ({ ...f, technicalSheetUrl: e.target.value }))}
          className="input-field"
        />
      </div>

      {specKind === "panel" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-700/40">
          <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Ficha técnica (paneles)</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-0.5 block text-xs text-slate-600">Potencia (W)</label><input type="number" className="input-field" value={form.panelSpecs.powerW} onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, powerW: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Eficiencia (%)</label><input type="number" step="0.01" className="input-field" value={form.panelSpecs.efficiencyPercent} onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, efficiencyPercent: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Vmp (V)</label><input type="number" step="0.01" className="input-field" value={form.panelSpecs.vmpV} onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, vmpV: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Imp (A)</label><input type="number" step="0.01" className="input-field" value={form.panelSpecs.impA} onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, impA: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Voc (V)</label><input type="number" step="0.01" className="input-field" value={form.panelSpecs.vocV} onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, vocV: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Isc (A)</label><input type="number" step="0.01" className="input-field" value={form.panelSpecs.iscA} onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, iscA: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Bifacialidad (%)</label><input type="number" step="0.01" className="input-field" value={form.panelSpecs.bifacialityPercent} onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, bifacialityPercent: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Tipo de célula</label><input type="text" className="input-field" value={form.panelSpecs.cellType} onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, cellType: e.target.value } }))} placeholder="Ej. Monocristalino" /></div>
            <div>
              <label className="mb-0.5 block text-xs text-slate-600">Largo (mm)</label>
              <input
                type="number"
                className="input-field"
                value={form.panelSpecs.lengthMm}
                onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, lengthMm: e.target.value } }))}
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-slate-600">Ancho (mm)</label>
              <input
                type="number"
                className="input-field"
                value={form.panelSpecs.widthMm}
                onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, widthMm: e.target.value } }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-0.5 block text-xs text-slate-600">Espesor (mm)</label>
              <div>
                <input
                  type="number"
                  className="input-field"
                  value={form.panelSpecs.heightMm}
                  onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, heightMm: e.target.value } }))}
                />
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Referencia técnica de dimensiones del panel
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Vista frontal */}
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-700/30">
                    <svg viewBox="0 0 420 190" className="h-[170px] w-full" role="img" aria-label="Vista frontal del panel">
                      {/* Marco frontal */}
                      <rect x="110" y="45" width="200" height="95" fill="none" stroke="currentColor" strokeWidth="4" />

                      {/* Flecha Largo (horizontal) */}
                      <line x1="135" y1="155" x2="285" y2="155" stroke="currentColor" strokeWidth="4" />
                      <polygon points="285,155 270,145 270,165" fill="currentColor" />
                      <polygon points="135,155 150,145 150,165" fill="currentColor" />
                      <text x="210" y="180" fontSize="16" textAnchor="middle" fill="currentColor">Largo</text>

                      {/* Flecha Ancho (vertical) */}
                      <line x1="90" y1="60" x2="90" y2="130" stroke="currentColor" strokeWidth="4" />
                      <polygon points="90,60 78,73 102,73" fill="currentColor" />
                      <polygon points="90,130 78,117 102,117" fill="currentColor" />
                      <text x="70" y="100" fontSize="16" textAnchor="middle" fill="currentColor" transform="rotate(-90 70 100)">Ancho</text>
                    </svg>
                  </div>

                  {/* Vista lateral */}
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-700/30">
                    <svg viewBox="0 0 420 190" className="h-[170px] w-full" role="img" aria-label="Vista lateral del panel con espesor">
                      {/* Perfil muy angosto (rectángulo vertical) */}
                      <rect x="185" y="45" width="50" height="120" fill="none" stroke="currentColor" strokeWidth="4" />

                      {/* Cota de espesor (limpia, fuera del perfil) */}
                      {/* Flechas en ambos extremos */}
                      <line x1="195" y1="25" x2="225" y2="25" stroke="currentColor" strokeWidth="4" />
                      <polygon points="195,25 180,15 180,35" fill="currentColor" />
                      <polygon points="225,25 240,15 240,35" fill="currentColor" />
                      {/* Texto fuera del rectángulo */}
                      <text x="210" y="10" fontSize="16" textAnchor="middle" fill="currentColor">Espesor</text>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Peso (kg)</label><input type="number" step="0.01" className="input-field" value={form.panelSpecs.weightKg} onChange={(e) => setForm((f) => ({ ...f, panelSpecs: { ...f.panelSpecs!, weightKg: e.target.value } }))} /></div>
          </div>
        </div>
      )}
      {specKind === "inverter" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-700/40">
          <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Ficha técnica (inversor)</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-0.5 block text-xs text-slate-600">Tipo</label><select className="input-field" value={form.inverterSpecs.inverterType} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, inverterType: e.target.value } }))}><option value="">—</option><option value="ON_GRID">On-grid</option><option value="HYBRID">Híbrido</option><option value="OFF_GRID">Off-grid</option></select></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Potencia AC (W)</label><input type="number" className="input-field" value={form.inverterSpecs.powerAcW} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, powerAcW: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Tensión máx. PV (V)</label><input type="number" step="0.01" className="input-field" value={form.inverterSpecs.maxPvVoltageV} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, maxPvVoltageV: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Tensión arranque (V)</label><input type="number" step="0.01" className="input-field" value={form.inverterSpecs.startupVoltageV} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, startupVoltageV: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">MPPT mín (V)</label><input type="number" step="0.01" className="input-field" value={form.inverterSpecs.mpptVoltageMinV} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, mpptVoltageMinV: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">MPPT máx (V)</label><input type="number" step="0.01" className="input-field" value={form.inverterSpecs.mpptVoltageMaxV} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, mpptVoltageMaxV: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Corriente DC máx. (A)</label><input type="number" step="0.01" className="input-field" value={form.inverterSpecs.maxDcCurrentA} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, maxDcCurrentA: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Eficiencia (%)</label><input type="number" step="0.01" className="input-field" value={form.inverterSpecs.efficiencyPercent} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, efficiencyPercent: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Conexión</label><select className="input-field" value={form.inverterSpecs.connectionType} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, connectionType: e.target.value } }))}><option value="">—</option><option value="MONOFASICO">Monofásico</option><option value="TRIFASICO">Trifásico</option></select></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Protección IP</label><input type="text" className="input-field" value={form.inverterSpecs.ipRating} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, ipRating: e.target.value } }))} placeholder="Ej. IP65" /></div>
            <div className="sm:col-span-2"><label className="mb-0.5 block text-xs text-slate-600">Comunicación</label><input type="text" className="input-field" value={form.inverterSpecs.communication} onChange={(e) => setForm((f) => ({ ...f, inverterSpecs: { ...f.inverterSpecs!, communication: e.target.value } }))} placeholder="Ej. RS485, WiFi" /></div>
          </div>
        </div>
      )}
      {specKind === "battery" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-700/40">
          <h4 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Ficha técnica (batería)</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-0.5 block text-xs text-slate-600">Capacidad (kWh)</label><input type="number" step="0.01" className="input-field" value={form.batterySpecs.capacityKwh} onChange={(e) => setForm((f) => ({ ...f, batterySpecs: { ...f.batterySpecs!, capacityKwh: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Tensión nominal (V)</label><input type="number" step="0.01" className="input-field" value={form.batterySpecs.nominalVoltageV} onChange={(e) => setForm((f) => ({ ...f, batterySpecs: { ...f.batterySpecs!, nominalVoltageV: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Potencia carga/descarga (W)</label><input type="number" step="0.01" className="input-field" value={form.batterySpecs.maxChargeDischargePowerW} onChange={(e) => setForm((f) => ({ ...f, batterySpecs: { ...f.batterySpecs!, maxChargeDischargePowerW: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Química</label><input type="text" className="input-field" value={form.batterySpecs.chemistry} onChange={(e) => setForm((f) => ({ ...f, batterySpecs: { ...f.batterySpecs!, chemistry: e.target.value } }))} placeholder="Ej. NMC, LFP" /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Ciclos</label><input type="number" className="input-field" value={form.batterySpecs.cycles} onChange={(e) => setForm((f) => ({ ...f, batterySpecs: { ...f.batterySpecs!, cycles: e.target.value } }))} /></div>
            <div><label className="mb-0.5 block text-xs text-slate-600">Peso (kg)</label><input type="number" step="0.01" className="input-field" value={form.batterySpecs.weightKg} onChange={(e) => setForm((f) => ({ ...f, batterySpecs: { ...f.batterySpecs!, weightKg: e.target.value } }))} /></div>
            <div className="sm:col-span-2"><label className="mb-0.5 block text-xs text-slate-600">Dimensiones (mm)</label><input type="text" className="input-field" value={form.batterySpecs.dimensionsMm} onChange={(e) => setForm((f) => ({ ...f, batterySpecs: { ...f.batterySpecs!, dimensionsMm: e.target.value } }))} placeholder="Ej. 600x400x200" /></div>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Fabricante real</label>
        <input
          type="text"
          value={form.realManufacturer}
          onChange={(e) => setForm((f) => ({ ...f, realManufacturer: e.target.value }))}
          className="input-field"
          placeholder="Ej. Nombre del fabricante"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Estado comercial</label>
          <select
            value={form.commercialStatus}
            onChange={(e) => setForm((f) => ({ ...f, commercialStatus: e.target.value }))}
            className="input-field"
          >
            {COMMERCIAL_STATUS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Moneda base</label>
          <input
            type="text"
            value={form.defaultCurrency}
            onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value }))}
            className="input-field"
            placeholder="Ej. USD o CLP"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Garantía</label>
          <input
            type="text"
            value={form.warranty}
            onChange={(e) => setForm((f) => ({ ...f, warranty: e.target.value }))}
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
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Stock referencial</label>
          <input
            type="text"
            value={form.stockReference}
            onChange={(e) => setForm((f) => ({ ...f, stockReference: e.target.value }))}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Origen</label>
          <input
            type="text"
            value={form.origin}
            onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
            className="input-field"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Proveedor principal</label>
        <select
          value={form.primarySupplierId}
          onChange={(e) => setForm((f) => ({ ...f, primarySupplierId: e.target.value }))}
          className="input-field"
        >
          <option value="">Ninguno</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.supplyOrigin})</option>
          ))}
        </select>
        {suppliers.length === 0 && (
          <p className="mt-1 text-sm text-slate-600">
            No hay proveedores activos. <Link href="/proveedores/nuevo" className="text-amber-600 underline hover:no-underline">Cree uno en Proveedores</Link>.
          </p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Notas internas</label>
        <textarea
          rows={2}
          value={form.internalNotes}
          onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
          className="input-field"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
        </button>
        <Link href={isEdit ? `/productos/${props.initial.id}` : "/productos"} className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
