"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  fetchClients,
  fetchProduct,
  requestSolarResourceExternalEstimate,
  updateFvStudy,
  type Client,
  type FvStudy,
  type CreateFvStudyInput,
  type ImplantationDesign,
  type UpdateFvStudyInput,
  type SolarResourceExternalEstimateResponse,
} from "../../lib/api";
import {
  MESES_NOMBRES,
  CONNECTION_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  REFERENCE_MONTH_OPTIONS,
  CURRENCY_OPTIONS,
  MOUNTING_TYPE_OPTIONS,
  getMountingBusinessLabel,
  GENERATION_SOURCE_OPTIONS,
} from "./constants";
import { MARGIN_SYSTEM_TYPE_OPTIONS } from "../../lib/margin-technical-basics";
import { FV_SYSTEM_TYPE_HINTS, normalizeFvStudySystemType } from "./fvStudySystemType";
import { getScenarioLabel } from "../../lib/fv-system-scenario";

type MonthRow = { monthIndex: number; consumptionKwh: string; generationKwh: string };

type FormState = {
  clientId: string;
  title: string;
  referenceMonth: number;
  referenceBillAmount: string;
  referenceConsumptionKwh: string;
  valorKwhConsumo: string;
  valorKwhInyeccion: string;
  currency: string;
  connectionType: string;
  tipoProyecto: string;
  systemType: "ON_GRID" | "HYBRID" | "OFF_GRID";
  utilityGridAvailable: boolean;
  gridExportEnabled: boolean;
  potenciaPorPanelWp: string;
  coberturaDeseada: string;
  potenciaSistemaKwp: string;
  latitude: string;
  longitude: string;
  mountingType: string;
  tiltDegrees: string;
  azimuthDegrees: string;
  solarResourceProvider: string;
  generationSource: "INTERNAL" | "MANUAL" | "EXPLORADOR_SOLAR";
  months: MonthRow[];
};

/**
 * Valores iniciales al elegir tipo de sistema (sin estados inválidos ni transitorios).
 */
function applySystemTypeRules(
  systemType: FormState["systemType"],
  _prevState: FormState,
): Pick<FormState, "utilityGridAvailable" | "gridExportEnabled"> {
  switch (systemType) {
    case "OFF_GRID":
      return { utilityGridAvailable: false, gridExportEnabled: false };
    case "HYBRID":
      return { utilityGridAvailable: true, gridExportEnabled: true };
    case "ON_GRID":
    default:
      return { utilityGridAvailable: true, gridExportEnabled: true };
  }
}

function fvGridFlagsFromStudy(study: FvStudy): Pick<FormState, "utilityGridAvailable" | "gridExportEnabled"> {
  const st = normalizeFvStudySystemType(study.systemType);
  if (st === "OFF_GRID") {
    return {
      utilityGridAvailable: study.utilityGridAvailable === true,
      gridExportEnabled: false,
    };
  }
  return {
    utilityGridAvailable: true,
    gridExportEnabled: study.gridExportEnabled !== false,
  };
}

const defaultMonths: MonthRow[] = MESES_NOMBRES.map((_, i) => ({
  monthIndex: i + 1,
  consumptionKwh: "",
  generationKwh: "",
}));

function toFormState(study: FvStudy | null, preselectedClientId?: string, design?: ImplantationDesign | null): FormState {
  if (!study) {
    return {
      clientId: preselectedClientId ?? "",
      title: "",
      referenceMonth: 1,
      referenceBillAmount: "",
      referenceConsumptionKwh: "",
      valorKwhConsumo: "",
      valorKwhInyeccion: "",
      currency: "CLP",
      connectionType: "MONOFASICO",
      tipoProyecto: "RESIDENCIAL",
      systemType: "ON_GRID",
      ...applySystemTypeRules("ON_GRID", {} as FormState),
      potenciaPorPanelWp: "400",
      coberturaDeseada: "80",
      potenciaSistemaKwp: "",
      latitude: "",
      longitude: "",
      mountingType: "",
      tiltDegrees: "",
      azimuthDegrees: "",
      solarResourceProvider: "",
      generationSource: "INTERNAL",
      months: defaultMonths.map((m) => ({ ...m })),
    };
  }
  const source =
    study.generationSource === "MANUAL"
      ? "MANUAL"
      : study.generationSource === "EXPLORADOR_SOLAR"
        ? "EXPLORADOR_SOLAR"
        : "INTERNAL";
  const months: MonthRow[] = (study.months ?? [])
    .sort((a, b) => a.monthIndex - b.monthIndex)
    .map((m) => ({
      monthIndex: m.monthIndex,
      consumptionKwh: m.consumptionKwh > 0 ? String(m.consumptionKwh) : "",
      generationKwh: m.generationKwh != null && m.generationKwh > 0 ? String(m.generationKwh) : "",
    }));
  while (months.length < 12) {
    months.push({ monthIndex: months.length + 1, consumptionKwh: "", generationKwh: "" });
  }

  const powerFromDesign = design?.panelPowerWSnapshot != null && design.panelPowerWSnapshot > 0 ? String(design.panelPowerWSnapshot) : null;
  const powerFromStudy = study.potenciaPorPanelWp != null && study.potenciaPorPanelWp > 0 ? String(study.potenciaPorPanelWp) : null;
  const potenciaPorPanelWp = powerFromDesign ?? powerFromStudy ?? "400";

  const latStudy = study.latitude != null ? String(study.latitude) : null;
  const latDesign = design?.centerLat != null ? String(design.centerLat) : null;
  const latitude = latStudy ?? latDesign ?? "";

  const lngStudy = study.longitude != null ? String(study.longitude) : null;
  const lngDesign = design?.centerLng != null ? String(design.centerLng) : null;
  const longitude = lngStudy ?? lngDesign ?? "";

  return {
    clientId: study.clientId,
    title: study.title,
    referenceMonth: study.referenceMonth,
    referenceBillAmount: study.referenceBillAmount != null ? String(study.referenceBillAmount) : "",
    referenceConsumptionKwh: study.referenceConsumptionKwh != null ? String(study.referenceConsumptionKwh) : "",
    valorKwhConsumo: String(study.valorKwhConsumo),
    valorKwhInyeccion: String(study.valorKwhInyeccion),
    currency: study.currency ?? "USD",
    connectionType: study.connectionType,
    tipoProyecto: study.tipoProyecto,
    systemType: normalizeFvStudySystemType(study.systemType),
    ...fvGridFlagsFromStudy(study),
    potenciaPorPanelWp,
    coberturaDeseada: String(study.coberturaDeseada),
    potenciaSistemaKwp: study.potenciaSistemaKwp != null ? String(study.potenciaSistemaKwp) : "",
    latitude,
    longitude,
    mountingType: study.mountingType ?? "",
    tiltDegrees: study.tiltDegrees != null ? String(study.tiltDegrees) : "",
    azimuthDegrees: (() => {
      if (study.azimuthDegrees != null) return String(study.azimuthDegrees);
      const degs = design?.placements?.map((p) => p.orientationDeg).filter((d) => d != null) ?? [];
      const unique = [...new Set(degs.map((d) => Math.round(Number(d))))];
      if (unique.length === 1) return String(unique[0]);
      return "";
    })(),
    solarResourceProvider: study.solarResourceProvider ?? "",
    generationSource: source,
    months: months.length >= 12 ? months.slice(0, 12) : [...months, ...defaultMonths.slice(months.length, 12)],
  };
}

/** Calcula generación mensual estimada (anual/12) como ayuda visual al pasar a MANUAL. El backend es la fuente de verdad al guardar. */
function estimateInternalGenerationMonthly(form: FormState): number[] {
  const parseNum = (s: string, def: number) => {
    const v = parseFloat(s?.replace(",", "."));
    return Number.isFinite(v) ? v : def;
  };
  const consumoAnual = form.months.reduce((s, m) => s + parseNum(m.consumptionKwh, 0), 0);
  const cobertura = Math.min(100, Math.max(0, parseNum(form.coberturaDeseada, 80))) / 100;
  const hsp = 5.5;
  const pr = 0.85;
  const potenciaPanel = parseNum(form.potenciaPorPanelWp, 400) || 400;
  const generacionAnualPorKwp = hsp * 365 * pr;
  if (generacionAnualPorKwp <= 0) return Array(12).fill(0);
  const energiaACubrir = consumoAnual * cobertura;
  const plantaKwp = energiaACubrir / generacionAnualPorKwp;
  const cantidadPaneles = Math.ceil((plantaKwp * 1000) / potenciaPanel);
  const potenciaRealKwp = (cantidadPaneles * potenciaPanel) / 1000;
  const generacionAnualKwh = potenciaRealKwp * hsp * 365 * pr;
  const mensual = generacionAnualKwh / 12;
  return Array(12).fill(mensual);
}

/** Botón que aplica la generación mensual calculada (PVWatts u otro) a la tabla del estudio sin pisar consumos. */
function ApplyGenerationButton({
  studyId,
  formMonths,
  monthlyGeneration,
  onApplied,
}: {
  studyId: string;
  formMonths: MonthRow[];
  monthlyGeneration: Array<{ month: number; label: string; generationKwh: number }>;
  onApplied: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const handleApply = async () => {
    if (monthlyGeneration.length < 12) return;
    setApplyError(null);
    setApplying(true);
    try {
      const months = formMonths.map((m) => ({
        monthIndex: m.monthIndex,
        consumptionKwh: parseFloat(m.consumptionKwh) || 0,
        generationKwh: monthlyGeneration[m.monthIndex - 1]?.generationKwh ?? 0,
      }));
      await updateFvStudy(studyId, { generationSource: "MANUAL", months });
      onApplied();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setApplying(false);
    }
  };
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleApply}
        disabled={applying}
        className="rounded border border-green-600 bg-green-50 px-2 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-50 dark:border-green-500 dark:bg-green-900/30 dark:text-green-200 dark:hover:bg-green-900/50"
      >
        {applying ? "Aplicando…" : "Aplicar generación mensual calculada"}
      </button>
      {applyError && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {applyError}
        </p>
      )}
    </div>
  );
}

type Props =
  | {
      mode: "create";
      preselectedClientId?: string;
      onSubmit: (data: CreateFvStudyInput) => Promise<void>;
      /** Si se proporciona, en la card Diseño de implantación se muestra "Guardar y abrir diseño de implantación" que crea el estudio y redirige al diseño. */
      onSubmitAndOpenDesign?: (data: CreateFvStudyInput) => Promise<void>;
    }
  | {
      mode: "edit";
      initial: FvStudy;
      /** Diseño de implantación: se usa para rellenar potencia, coordenadas y hint de panel/bifacial cuando el estudio no tiene valor. */
      initialDesign?: ImplantationDesign | null;
      onSubmit: (data: UpdateFvStudyInput) => Promise<void>;
    };

export function EstudioFvForm(props: Props) {
  const isEdit = props.mode === "edit";
  const initialDesign = isEdit ? (props as { initialDesign?: ImplantationDesign | null }).initialDesign : undefined;
  const initial = isEdit ? toFormState(props.initial, undefined, initialDesign) : toFormState(null, props.preselectedClientId);
  const [form, setForm] = useState<FormState>(initial);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateResult, setEstimateResult] = useState<SolarResourceExternalEstimateResponse | null>(null);
  const [panelBifacialHint, setPanelBifacialHint] = useState<string | null>(null);
  const [panelBifacialYesNo, setPanelBifacialYesNo] = useState<boolean | null>(null);
  const [azimuthMultipleHint, setAzimuthMultipleHint] = useState<string | null>(null);

  /** Navegación vertical en la tabla mensual (índice 0 = enero). */
  const consumptionInputRefs = useRef<(HTMLInputElement | null)[]>(Array.from({ length: 12 }, () => null));
  const generationInputRefs = useRef<(HTMLInputElement | null)[]>(Array.from({ length: 12 }, () => null));

  const studyId = isEdit ? (props as { initial: FvStudy }).initial?.id : undefined;

  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch(() => {});
  }, []);

  const initialData = isEdit ? (props as { initial: FvStudy }).initial : undefined;
  useEffect(() => {
    if (isEdit && initialData) setForm(toFormState(initialData, undefined, initialDesign));
  }, [isEdit, initialData?.id, initialDesign?.id]);

  useEffect(() => {
    if (!isEdit || !initialDesign?.panelProductId) {
      setPanelBifacialHint(null);
      setPanelBifacialYesNo(null);
      return;
    }
    let cancelled = false;
    fetchProduct(initialDesign.panelProductId)
      .then((product) => {
        if (cancelled) return;
        const bif = product.panelSpecs?.bifacialityPercent;
        const name = initialDesign.panelNameSnapshot?.trim() || product.name;
        const power = initialDesign.panelPowerWSnapshot ?? product.panelSpecs?.powerW;
        const powerStr = power != null ? ` ${power} W` : "";
        setPanelBifacialYesNo(bif != null && Number(bif) > 0);
        setPanelBifacialHint(`Panel del diseño: ${name}${powerStr}.`);
      })
      .catch(() => {
        if (!cancelled) {
          setPanelBifacialYesNo(null);
          setPanelBifacialHint(
            initialDesign.panelNameSnapshot?.trim()
              ? `Panel del diseño: ${initialDesign.panelNameSnapshot} (${initialDesign.panelPowerWSnapshot ?? "—"} W).`
              : null,
          );
        }
      });
    return () => { cancelled = true; };
  }, [isEdit, initialDesign?.panelProductId, initialDesign?.panelNameSnapshot, initialDesign?.panelPowerWSnapshot]);

  useEffect(() => {
    if (!isEdit || !initialDesign?.placements?.length) {
      setAzimuthMultipleHint(null);
      return;
    }
    const degs = initialDesign.placements
      .map((p) => p.orientationDeg)
      .filter((d): d is number => d != null && Number.isFinite(d));
    const unique = [...new Set(degs.map((d) => Math.round(d)))].sort((a, b) => a - b);
    if (unique.length > 1) {
      setAzimuthMultipleHint(`Múltiples orientaciones en diseño: ${unique.join("°, ")}°.`);
    } else {
      setAzimuthMultipleHint(null);
    }
  }, [isEdit, initialDesign?.placements]);

  useEffect(() => {
    if (form.generationSource !== "EXPLORADOR_SOLAR") {
      setEstimateResult(null);
      setEstimateError(null);
      setEstimateLoading(false);
    }
  }, [form.generationSource]);

  const handleMonthConsumptionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, monthIndex: number) => {
      const { key, shiftKey } = e;
      if (key === "Enter" || key === "Tab") {
        if (!shiftKey) {
          if (monthIndex < 12) {
            e.preventDefault();
            consumptionInputRefs.current[monthIndex]?.focus();
          } else if (form.generationSource === "MANUAL") {
            e.preventDefault();
            generationInputRefs.current[0]?.focus();
          }
        } else if (shiftKey && monthIndex > 1) {
          e.preventDefault();
          consumptionInputRefs.current[monthIndex - 2]?.focus();
        }
        return;
      }
      if (key === "ArrowRight" && form.generationSource === "MANUAL") {
        const input = e.currentTarget;
        const len = input.value.length;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        if (start === end && start === len) {
          e.preventDefault();
          generationInputRefs.current[monthIndex - 1]?.focus();
        }
      }
    },
    [form.generationSource],
  );

  const handleMonthGenerationKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, monthIndex: number) => {
      const { key, shiftKey } = e;
      if (key === "Enter" || key === "Tab") {
        if (!shiftKey && monthIndex < 12) {
          e.preventDefault();
          generationInputRefs.current[monthIndex]?.focus();
        } else if (shiftKey) {
          if (monthIndex > 1) {
            e.preventDefault();
            generationInputRefs.current[monthIndex - 2]?.focus();
          } else {
            e.preventDefault();
            generationInputRefs.current[11]?.focus();
          }
        }
        return;
      }
      if (key === "ArrowLeft" && form.generationSource === "MANUAL") {
        const input = e.currentTarget;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        if (start === end && start === 0) {
          e.preventDefault();
          consumptionInputRefs.current[monthIndex - 1]?.focus();
        }
      }
    },
    [form.generationSource],
  );

  const update = (updates: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...updates };
      if (updates.generationSource === "MANUAL" && prev.generationSource === "INTERNAL") {
        const estimated = estimateInternalGenerationMonthly(next);
        next.months = next.months.map((m, i) => ({
          ...m,
          generationKwh: m.generationKwh !== "" ? m.generationKwh : String(Math.round(estimated[i] * 100) / 100),
        }));
      }
      return next;
    });
  };
  const updateMonth = (index: number, consumptionKwh: string) => {
    setForm((prev) => ({
      ...prev,
      months: prev.months.map((m) =>
        m.monthIndex === index ? { ...m, consumptionKwh } : m
      ),
    }));
  };
  const updateMonthGeneration = (index: number, generationKwh: string) => {
    setForm((prev) => ({
      ...prev,
      months: prev.months.map((m) =>
        m.monthIndex === index ? { ...m, generationKwh } : m
      ),
    }));
  };

  const parseNum = (s: string, def: number): number => {
    const v = parseFloat(s?.replace(",", "."));
    return Number.isFinite(v) ? v : def;
  };

  /** Validación y construcción del payload para create. Devuelve null si la validación falla (y setea error). */
  function getCreatePayloadIfValid(): CreateFvStudyInput | null {
    if (form.generationSource === "MANUAL") {
      const missing = form.months.filter((m) => {
        const g = parseNum(m.generationKwh, -1);
        return m.generationKwh.trim() === "" || g < 0;
      });
      if (missing.length > 0) {
        setError("En modo Generación mensual manual debe completar Consumo (kWh) y Generación (kWh) para los 12 meses. Los valores deben ser ≥ 0.");
        return null;
      }
    }
    if (!form.clientId.trim()) {
      setError("Seleccione un cliente.");
      return null;
    }
    if (!form.title.trim()) {
      setError("El título es obligatorio.");
      return null;
    }
    const months =
      form.generationSource === "MANUAL"
        ? form.months.map((m) => ({
            monthIndex: m.monthIndex,
            consumptionKwh: parseNum(m.consumptionKwh, 0),
            generationKwh: parseNum(m.generationKwh, 0),
          }))
        : form.months.map((m) => ({
            monthIndex: m.monthIndex,
            consumptionKwh: parseNum(m.consumptionKwh, 0),
          }));
    const solarPayload = {
      latitude: form.latitude.trim() ? parseNum(form.latitude, 0) : undefined,
      longitude: form.longitude.trim() ? parseNum(form.longitude, 0) : undefined,
      mountingType: form.mountingType.trim() || undefined,
      tiltDegrees: form.tiltDegrees.trim() ? parseNum(form.tiltDegrees, 0) : undefined,
      azimuthDegrees: form.azimuthDegrees.trim() ? parseNum(form.azimuthDegrees, 0) : undefined,
      solarResourceProvider: form.solarResourceProvider.trim() || undefined,
    };
    return {
      clientId: form.clientId,
      title: form.title.trim(),
      referenceMonth: form.referenceMonth,
      referenceBillAmount: form.referenceBillAmount ? parseNum(form.referenceBillAmount, 0) : undefined,
      referenceConsumptionKwh: form.referenceConsumptionKwh ? parseNum(form.referenceConsumptionKwh, 0) : undefined,
      valorKwhConsumo: parseNum(form.valorKwhConsumo, 0),
      valorKwhInyeccion: parseNum(form.valorKwhInyeccion, 0),
      currency: form.currency || "USD",
      connectionType: form.connectionType,
      tipoProyecto: form.tipoProyecto,
      systemType: form.systemType,
      utilityGridAvailable: form.utilityGridAvailable,
      gridExportEnabled: form.gridExportEnabled,
      potenciaPorPanelWp: parseNum(form.potenciaPorPanelWp, 400),
      coberturaDeseada: parseNum(form.coberturaDeseada, 80),
      potenciaSistemaKwp: form.potenciaSistemaKwp ? parseNum(form.potenciaSistemaKwp, 0) : undefined,
      latitude: solarPayload.latitude,
      longitude: solarPayload.longitude,
      mountingType: solarPayload.mountingType,
      tiltDegrees: solarPayload.tiltDegrees,
      azimuthDegrees: solarPayload.azimuthDegrees,
      solarResourceProvider: solarPayload.solarResourceProvider,
      generationSource: form.generationSource,
      months,
    };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isEdit) {
        if (form.generationSource === "MANUAL") {
          const missing = form.months.filter((m) => {
            const g = parseNum(m.generationKwh, -1);
            return m.generationKwh.trim() === "" || g < 0;
          });
          if (missing.length > 0) {
            setError("En modo Generación mensual manual debe completar Consumo (kWh) y Generación (kWh) para los 12 meses. Los valores deben ser ≥ 0.");
            return;
          }
        }
        const months =
          form.generationSource === "MANUAL"
            ? form.months.map((m) => ({
                monthIndex: m.monthIndex,
                consumptionKwh: parseNum(m.consumptionKwh, 0),
                generationKwh: parseNum(m.generationKwh, 0),
              }))
            : form.months.map((m) => ({
                monthIndex: m.monthIndex,
                consumptionKwh: parseNum(m.consumptionKwh, 0),
              }));
        const solarPayload = {
          latitude: form.latitude.trim() ? parseNum(form.latitude, 0) : undefined,
          longitude: form.longitude.trim() ? parseNum(form.longitude, 0) : undefined,
          mountingType: form.mountingType.trim() || undefined,
          tiltDegrees: form.tiltDegrees.trim() ? parseNum(form.tiltDegrees, 0) : undefined,
          azimuthDegrees: form.azimuthDegrees.trim() ? parseNum(form.azimuthDegrees, 0) : undefined,
          solarResourceProvider: form.solarResourceProvider.trim() || undefined,
        };
        const solarPayloadNulls = {
          latitude: form.latitude.trim() ? solarPayload.latitude ?? null : null,
          longitude: form.longitude.trim() ? solarPayload.longitude ?? null : null,
          mountingType: form.mountingType.trim() ? solarPayload.mountingType ?? null : null,
          tiltDegrees: form.tiltDegrees.trim() ? solarPayload.tiltDegrees ?? null : null,
          azimuthDegrees: form.azimuthDegrees.trim() ? solarPayload.azimuthDegrees ?? null : null,
          solarResourceProvider: form.solarResourceProvider.trim() ? solarPayload.solarResourceProvider ?? null : null,
        };
        await props.onSubmit({
          title: form.title.trim() || undefined,
          referenceMonth: form.referenceMonth,
          referenceBillAmount: form.referenceBillAmount ? parseNum(form.referenceBillAmount, 0) : undefined,
          referenceConsumptionKwh: form.referenceConsumptionKwh ? parseNum(form.referenceConsumptionKwh, 0) : undefined,
          valorKwhConsumo: parseNum(form.valorKwhConsumo, 0),
          valorKwhInyeccion: parseNum(form.valorKwhInyeccion, 0),
          currency: form.currency || undefined,
          connectionType: form.connectionType,
          tipoProyecto: form.tipoProyecto,
          systemType: form.systemType,
          utilityGridAvailable: form.utilityGridAvailable,
          gridExportEnabled: form.gridExportEnabled,
          potenciaPorPanelWp: parseNum(form.potenciaPorPanelWp, 400),
          coberturaDeseada: parseNum(form.coberturaDeseada, 80),
          potenciaSistemaKwp: form.potenciaSistemaKwp ? parseNum(form.potenciaSistemaKwp, 0) : undefined,
          latitude: solarPayloadNulls.latitude,
          longitude: solarPayloadNulls.longitude,
          mountingType: solarPayloadNulls.mountingType,
          tiltDegrees: solarPayloadNulls.tiltDegrees,
          azimuthDegrees: solarPayloadNulls.azimuthDegrees,
          solarResourceProvider: solarPayloadNulls.solarResourceProvider,
          generationSource: form.generationSource,
          months,
        });
      } else {
        const payload = getCreatePayloadIfValid();
        if (payload) await props.onSubmit(payload);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  /** Crea el estudio y redirige al diseño de implantación. Misma validación que submit normal. */
  const handleSaveAndOpenDesign = async () => {
    if (props.mode !== "create" || !("onSubmitAndOpenDesign" in props) || !props.onSubmitAndOpenDesign) return;
    setError(null);
    const payload = getCreatePayloadIfValid();
    if (!payload) return;
    setSaving(true);
    try {
      await props.onSubmitAndOpenDesign(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-invalid={!!error} aria-describedby={error ? "fv-study-form-error" : undefined}>
      {error && (
        <div id="fv-study-form-error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      <div className="card p-6">
        <h3 className="mb-4 text-lg font-medium text-slate-800">Datos generales</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cliente *</label>
              <select
                value={form.clientId}
                onChange={(e) => update({ clientId: e.target.value })}
                className="input-field w-full"
                required
              >
                <option value="">Seleccione cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="mt-1 text-sm text-slate-600">
                  Aún no hay clientes. <Link href="/clientes/nuevo" className="text-amber-600 underline hover:no-underline">Cree uno en Clientes</Link>.
                </p>
              )}
            </div>
          )}
          <div className={isEdit ? "sm:col-span-2" : ""}>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Título del estudio *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              className="input-field w-full"
              placeholder="Ej. Estudio Casa García – Ene 2025"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Mes de referencia</label>
            <select
              value={form.referenceMonth}
              onChange={(e) => update({ referenceMonth: Number(e.target.value) })}
              className="input-field w-full"
            >
              {REFERENCE_MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta de referencia (opcional)</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.referenceBillAmount}
              onChange={(e) => update({ referenceBillAmount: e.target.value })}
              className="input-field w-full"
              placeholder="Ej. 45000"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Consumo referencia kWh (opcional)</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.referenceConsumptionKwh}
              onChange={(e) => update({ referenceConsumptionKwh: e.target.value })}
              className="input-field w-full"
              placeholder="Ej. 280"
            />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="mb-4 text-lg font-medium text-slate-800">Parámetros tarifarios</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Valor kWh consumo *</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.valorKwhConsumo}
              onChange={(e) => update({ valorKwhConsumo: e.target.value })}
              className="input-field w-full"
              placeholder="Ej. 0.15"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Valor kWh inyección *</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.valorKwhInyeccion}
              onChange={(e) => update({ valorKwhInyeccion: e.target.value })}
              className="input-field w-full"
              placeholder="Ej. 0.08"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Moneda</label>
            <select
              value={form.currency}
              onChange={(e) => update({ currency: e.target.value })}
              className="input-field w-full"
            >
              {CURRENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="mb-4 text-lg font-medium text-slate-800">Diseño de implantación</h3>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          En el diseño de implantación se definen o consolidan la ubicación, cantidad de paneles, datos técnicos del layout y la base para Explorador Solar. Esa información alimenta las secciones siguientes (técnicos, recurso solar).
        </p>
        {studyId ? (
          <Link
            href={`/estudios-fv/${studyId}/diseno-implantacion?returnTo=edit`}
            className="inline-flex items-center rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Abrir diseño de implantación
          </Link>
        ) : props.mode === "create" && "onSubmitAndOpenDesign" in props && props.onSubmitAndOpenDesign ? (
          <button
            type="button"
            onClick={handleSaveAndOpenDesign}
            disabled={saving}
            className="inline-flex items-center rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar y abrir diseño de implantación"}
          </button>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Guarde el estudio para acceder al diseño de implantación.
          </p>
        )}
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="mb-3 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Técnicos y conexión
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tipo de conexión *
            </label>
            <select
              value={form.connectionType}
              onChange={(e) => update({ connectionType: e.target.value })}
              className="input-field w-full py-2"
            >
              {CONNECTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tipo de proyecto *
            </label>
            <select
              value={form.tipoProyecto}
              onChange={(e) => update({ tipoProyecto: e.target.value })}
              className="input-field w-full py-2"
            >
              {PROJECT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tipo de sistema *
            </label>
            <select
              value={form.systemType}
              onChange={(e) => {
                const systemType = e.target.value as FormState["systemType"];
                setForm((prev) => ({
                  ...prev,
                  systemType,
                  ...applySystemTypeRules(systemType, prev),
                }));
              }}
              className="input-field w-full py-2"
            >
              {MARGIN_SYSTEM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p
              className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400"
              title={`${FV_SYSTEM_TYPE_HINTS[form.systemType].title}. ${FV_SYSTEM_TYPE_HINTS[form.systemType].lines.join(" ")}`}
            >
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {FV_SYSTEM_TYPE_HINTS[form.systemType].title}.
              </span>{" "}
              {FV_SYSTEM_TYPE_HINTS[form.systemType].lines.join(" · ")}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
              Híbrido y off-grid consideran baterías al cotizar desde el estudio.
            </p>
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Potencia por panel (Wp) *
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.potenciaPorPanelWp}
              onChange={(e) => update({ potenciaPorPanelWp: e.target.value })}
              className="input-field w-full py-2"
              placeholder="Ej. 400"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <div className="rounded-lg border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white px-3 py-2.5 shadow-sm dark:border-slate-600 dark:from-slate-800/40 dark:to-slate-900/20">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Configuración de red
              </h4>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-1">
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className="sr-only">Red disponible</legend>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="w-[7.5rem] shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">
                      Red disponible
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="fv-utility-grid"
                          className="h-3.5 w-3.5 shrink-0 border-slate-300 text-amber-600 focus:ring-amber-500"
                          checked={form.utilityGridAvailable}
                          disabled={form.systemType !== "OFF_GRID"}
                          onChange={() => {
                            if (form.systemType !== "OFF_GRID") return;
                            update({ utilityGridAvailable: true, gridExportEnabled: false });
                          }}
                        />
                        Sí
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="fv-utility-grid"
                          className="h-3.5 w-3.5 shrink-0 border-slate-300 text-amber-600 focus:ring-amber-500"
                          checked={!form.utilityGridAvailable}
                          disabled={form.systemType !== "OFF_GRID"}
                          onChange={() => {
                            if (form.systemType !== "OFF_GRID") return;
                            update({ utilityGridAvailable: false, gridExportEnabled: false });
                          }}
                        />
                        No
                      </label>
                    </div>
                    {form.systemType !== "OFF_GRID" && (
                      <span className="text-[10px] leading-tight text-slate-400 dark:text-slate-500 sm:ml-0">
                        Red asumida disponible (on-grid / híbrido).
                      </span>
                    )}
                  </div>
                </fieldset>
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className="sr-only">Inyección a red</legend>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="w-[7.5rem] shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">
                      Inyección a red
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="fv-grid-export"
                          className="h-3.5 w-3.5 shrink-0 border-slate-300 text-amber-600 focus:ring-amber-500"
                          checked={form.gridExportEnabled}
                          disabled={form.systemType === "OFF_GRID"}
                          onChange={() => {
                            if (form.systemType === "OFF_GRID") return;
                            update({ utilityGridAvailable: true, gridExportEnabled: true });
                          }}
                        />
                        Sí
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="fv-grid-export"
                          className="h-3.5 w-3.5 shrink-0 border-slate-300 text-amber-600 focus:ring-amber-500"
                          checked={!form.gridExportEnabled}
                          disabled={form.systemType === "OFF_GRID"}
                          onChange={() => {
                            if (form.systemType === "OFF_GRID") return;
                            update({ utilityGridAvailable: true, gridExportEnabled: false });
                          }}
                        />
                        No
                      </label>
                    </div>
                    {form.systemType === "OFF_GRID" && (
                      <span className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                        No aplica inyección en off-grid.
                      </span>
                    )}
                  </div>
                </fieldset>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2 rounded-md border border-amber-200/70 bg-amber-50/90 px-2.5 py-1.5 dark:border-amber-900/50 dark:bg-amber-950/35">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
                  Modo del sistema
                </span>
                <span className="text-sm font-semibold leading-tight text-amber-950 dark:text-amber-100">
                  {getScenarioLabel({
                    systemType: form.systemType,
                    utilityGridAvailable: form.utilityGridAvailable,
                    gridExportEnabled: form.gridExportEnabled,
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 mt-0.5 border-t border-slate-200/80 pt-3 dark:border-slate-600/80">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Datos complementarios
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {panelBifacialYesNo !== null && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Panel del diseño · bifacial</span>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${panelBifacialYesNo ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}
                    aria-label={panelBifacialYesNo ? "Panel bifacial" : "Panel no bifacial"}
                  >
                    {panelBifacialYesNo ? "Sí" : "No"}
                  </span>
                </div>
              )}
              {panelBifacialHint && (
                <div className="sm:col-span-2 rounded-md border border-slate-200/80 bg-slate-50/80 px-2.5 py-1.5 text-xs leading-snug text-slate-600 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                  {panelBifacialHint}
                </div>
              )}
              <div>
                <label className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Cobertura deseada (%) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.coberturaDeseada}
                  onChange={(e) => update({ coberturaDeseada: e.target.value })}
                  className="input-field w-full py-2"
                  placeholder="Ej. 80"
                  required
                />
              </div>
              <div>
                <label className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Potencia sistema kWp (opcional)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.potenciaSistemaKwp}
                  onChange={(e) => update({ potenciaSistemaKwp: e.target.value })}
                  className="input-field w-full py-2"
                  placeholder="Vacío = calcular"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="mb-2 text-lg font-medium text-slate-800">Recurso solar</h3>
        <p className="mb-4 text-sm text-slate-600">
          Elija el origen de la generación mensual. Ubicación, inclinación y montaje alimentan la estimación interna al guardar y el contexto del botón «Consultar…» cuando elige Explorador Solar.
        </p>
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Origen de la generación</label>
          <select
            value={form.generationSource}
            onChange={(e) =>
              update({
                generationSource: e.target.value as "INTERNAL" | "MANUAL" | "EXPLORADOR_SOLAR",
              })
            }
            className="input-field w-full max-w-xs"
          >
            {GENERATION_SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {form.generationSource === "MANUAL" && (
            <p className="mt-2 text-xs text-slate-500">
              Al cambiar a manual se prellenan las generaciones con una estimación (solo ayuda visual). El backend es la fuente de verdad al guardar.
            </p>
          )}
          {form.generationSource === "EXPLORADOR_SOLAR" && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              El backend puede llamar a la API del Explorador Solar (Minenergía) si{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">SOLAR_EXPLORER_*</code> está bien
              configurado; si no, intenta PVWatts (<code className="rounded bg-slate-100 px-1 dark:bg-slate-700">PVWATTS_*</code>
              ) o devuelve solo diagnóstico. La generación mensual del estudio no cambia sola: use «Aplicar generación…»
              cuando la respuesta traiga 12 meses.
            </p>
          )}
        </div>
        {form.generationSource === "INTERNAL" &&
          form.months.some((m) => m.generationKwh.trim() !== "") &&
          (isEdit ? initialData?.generationSource === "MANUAL" : true) && (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
              Al guardar, las generaciones manuales se reemplazarán por la estimación interna (promedio anual/12).
            </div>
          )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Latitud</label>
            <input
              type="number"
              step="any"
              min={-90}
              max={90}
              value={form.latitude}
              onChange={(e) => update({ latitude: e.target.value })}
              className="input-field w-full"
              placeholder="Ej. -33.45"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Longitud</label>
            <input
              type="number"
              step="any"
              min={-180}
              max={180}
              value={form.longitude}
              onChange={(e) => update({ longitude: e.target.value })}
              className="input-field w-full"
              placeholder="Ej. -70.67"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de montaje</label>
            <select
              value={form.mountingType}
              onChange={(e) => update({ mountingType: e.target.value })}
              className="input-field w-full"
            >
              <option value="">—</option>
              {MOUNTING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Inclinación (°)</label>
            <input
              type="number"
              step="any"
              min={0}
              max={90}
              value={form.tiltDegrees}
              onChange={(e) => update({ tiltDegrees: e.target.value })}
              className="input-field w-full"
              placeholder="Ej. 25"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Azimut (°)</label>
            <input
              type="number"
              step="any"
              min={0}
              max={360}
              value={form.azimuthDegrees}
              onChange={(e) => update({ azimuthDegrees: e.target.value })}
              className="input-field w-full"
              placeholder="Ej. 180"
            />
          </div>
          {azimuthMultipleHint && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200 sm:col-span-2 lg:col-span-3">
              {azimuthMultipleHint}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Proveedor recurso (opcional)</label>
            <input
              type="text"
              value={form.solarResourceProvider}
              onChange={(e) => update({ solarResourceProvider: e.target.value })}
              className="input-field w-full"
              placeholder="Solo si usa recurso externo"
            />
          </div>
        </div>
      </div>

      {form.generationSource === "EXPLORADOR_SOLAR" && (
        <div className="card border-slate-200 p-4 dark:border-slate-700">
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Contexto Explorador Solar</h3>
          {!studyId ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Guarde el estudio para consultar el contexto de Explorador Solar.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={async () => {
                  if (!studyId) return;
                  setEstimateError(null);
                  setEstimateResult(null);
                  setEstimateLoading(true);
                  try {
                    const res = await requestSolarResourceExternalEstimate(studyId);
                    setEstimateResult(res);
                  } catch (e) {
                    setEstimateError(e instanceof Error ? e.message : "Error al consultar");
                  } finally {
                    setEstimateLoading(false);
                  }
                }}
                disabled={estimateLoading}
                className="mb-3 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {estimateLoading ? "Consultando…" : "Consultar contexto / estimación externa"}
              </button>
              {estimateError && (
                <p className="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">
                  {estimateError}
                </p>
              )}
              {estimateResult && (
                <div className="space-y-2 text-sm">
                  {(() => {
                    const annual = estimateResult.annualGenerationKwh;
                    const months = estimateResult.monthlyGeneration;
                    const hasFullSeries =
                      annual != null &&
                      Number.isFinite(Number(annual)) &&
                      Array.isArray(months) &&
                      months.length >= 12 &&
                      months.every((m) => typeof m.generationKwh === "number" && Number.isFinite(m.generationKwh));
                    const metaErr = estimateResult.metadata?.error === true;
                    const providerTop = estimateResult.provider;
                    const showEstimateFailure =
                      metaErr === true ||
                      providerTop === "ESTIMATE_FAILED" ||
                      (!hasFullSeries &&
                        (estimateResult.metadata?.pvwattsFailure != null ||
                          (typeof estimateResult.metadata?.estimateFailureReason === "string" &&
                            estimateResult.metadata.estimateFailureReason !== "")));
                    const resolvedProvider =
                      String(estimateResult.metadata?.providerUsed ?? "").trim() !== ""
                        ? String(estimateResult.metadata?.providerUsed)
                        : providerTop;
                    const pvwattsFail =
                      estimateResult.metadata?.pvwattsFailure != null &&
                      typeof estimateResult.metadata.pvwattsFailure === "object"
                        ? (estimateResult.metadata.pvwattsFailure as { code?: string; messageForUser?: string })
                        : null;
                    const minenergiaFail =
                      estimateResult.metadata?.minenergiaFailure != null &&
                      typeof estimateResult.metadata.minenergiaFailure === "object"
                        ? (estimateResult.metadata.minenergiaFailure as { reason?: string; httpStatus?: number })
                        : null;
                    const failureReasonCode =
                      typeof estimateResult.metadata?.estimateFailureReason === "string"
                        ? estimateResult.metadata.estimateFailureReason
                        : null;
                    return (
                      <>
                  {showEstimateFailure && (
                    <div
                      className="rounded-md border border-red-200 bg-red-50/90 p-3 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
                      role="alert"
                    >
                      <p className="font-semibold">Estimación externa no disponible</p>
                      {pvwattsFail && (
                        <p className="mt-2 text-sm">
                          <span className="font-mono text-xs">{pvwattsFail.code ?? "PVWATTS_ERROR"}</span>
                          {": "}
                          {pvwattsFail.messageForUser ?? "Error PVWatts sin mensaje."}
                        </p>
                      )}
                      {!pvwattsFail && providerTop === "PVWATTS_V8" && (
                        <p className="mt-2 text-sm">
                          El servidor indicó PVWatts pero la respuesta no trae datos completos o tiene un formato inesperado. Si persiste, pida a quien administra el sistema que revise los registros del servidor en el momento de la consulta.
                        </p>
                      )}
                      {minenergiaFail?.reason && (
                        <p className="mt-2 text-sm text-red-800 dark:text-red-200">
                          Explorador Solar (Minenergía): {minenergiaFail.reason}
                          {minenergiaFail.httpStatus != null ? ` (código de respuesta ${minenergiaFail.httpStatus})` : ""}
                        </p>
                      )}
                      {failureReasonCode && (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          Referencia para soporte: <span className="font-mono">{failureReasonCode}</span>
                        </p>
                      )}
                      {estimateResult.message && (
                        <p className="mt-2 text-sm leading-snug">{estimateResult.message}</p>
                      )}
                    </div>
                  )}
                  {/* Proveedor usado en éxito: metadata.providerUsed; si falta, cae al provider raíz */}
                  {!showEstimateFailure && resolvedProvider === "EXPLORADOR_SOLAR" && (
                    <p className="font-medium text-emerald-700 dark:text-emerald-400">
                      Proveedor usado: Explorador Solar (API Minenergía).
                    </p>
                  )}
                  {!showEstimateFailure && resolvedProvider === "PVWATTS_V8" && hasFullSeries && (
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      {estimateResult.metadata?.explorerSolarSkipped === true
                        ? "Proveedor usado: PVWatts (NREL). Explorador Solar no se consultó: así está configurado el servidor (solo PVWatts)."
                        : estimateResult.metadata?.pvwattsFallbackBecauseMinenergiaFailed === true
                          ? "Proveedor usado: PVWatts (NREL) tras fallo de Explorador Solar."
                          : "Proveedor usado: PVWatts (NREL)."}
                    </p>
                  )}
                  {!showEstimateFailure && resolvedProvider === "PVWATTS_V8" && !hasFullSeries && (
                    <p className="font-medium text-amber-900 dark:text-amber-200" role="alert">
                      El servidor indicó PVWatts pero la respuesta no incluye 12 meses ni un total anual usable. Puede ser un fallo temporal del servicio NREL o de la configuración; reintente o consulte con soporte.
                    </p>
                  )}
                  {!showEstimateFailure && resolvedProvider === "INTERNAL_FROM_STUDY_HSP" ? (
                    <p className="font-medium text-sky-800 dark:text-sky-300">
                      Proveedor usado: estimación interna del estudio (HSP y PR guardados; mismo criterio que generación INTERNAL al guardar).
                    </p>
                  ) : null}
                  {!showEstimateFailure && resolvedProvider === "PVWATTS_V8"
                    && hasFullSeries
                    && String(estimateResult.metadata?.pvwattsMonthlyDerivation ?? "") !== ""
                    && String(estimateResult.metadata?.pvwattsMonthlyDerivation ?? "") !== "AC_MONTHLY" && (
                    <p className="text-xs text-slate-600 dark:text-slate-400" role="status">
                      {String(estimateResult.metadata?.pvwattsMonthlyDerivation ?? "") === "SOLRAD_PROPORTIONAL"
                        ? "Serie mensual derivada del anual AC y del perfil solar mensual de NREL (reparto proporcional)."
                        : "Serie mensual derivada repartiendo el anual AC en 12 partes iguales (NREL no entregó detalle mensual)."}
                    </p>
                  )}
                  {!showEstimateFailure && resolvedProvider === "INTERNAL_FROM_STUDY_HSP"
                    && String(estimateResult.metadata?.pvwattsMonthlyDerivation ?? "") === "INTERNAL_HSP_UNIFORM" && (
                    <p className="text-xs text-slate-600 dark:text-slate-400" role="status">
                      Doce meses iguales: anual = kWp × HSP × 365 × PR; cada mes = anual ÷ 12.
                    </p>
                  )}
                  {!showEstimateFailure && estimateResult.message && (
                    <p className="text-slate-600 dark:text-slate-400">{estimateResult.message}</p>
                  )}
                  <p className="text-slate-500 dark:text-slate-500">
                    Explorador Solar en servidor: {estimateResult.providerConfigured ? "configurado" : "no configurado"} · Datos del estudio listos para consultar servicios externos:{" "}
                    {estimateResult.requestReady ? "sí" : "no (complete ubicación, paneles y potencia)"}
                  </p>
                  {estimateResult.panelSource && (
                    <p className="text-slate-600 dark:text-slate-400">
                      Fuente paneles:{" "}
                      {estimateResult.panelSource === "IMPLANTATION_DESIGN"
                        ? "Diseño de implantación"
                        : "Estudio FV"}
                    </p>
                  )}
                  {estimateResult.usedContext && (
                    <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Latitud / Longitud</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {estimateResult.usedContext.latitude != null && estimateResult.usedContext.longitude != null
                            ? `${estimateResult.usedContext.latitude}, ${estimateResult.usedContext.longitude}`
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Cantidad paneles</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {estimateResult.usedContext.panelCount ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Potencia panel (Wp)</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {estimateResult.usedContext.panelPowerWp ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Potencia total (kW)</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {estimateResult.usedContext.systemPowerKw != null
                            ? estimateResult.usedContext.systemPowerKw.toFixed(2)
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Inclinación (°)</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {estimateResult.usedContext.tiltDegrees ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Azimut (°)</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {estimateResult.usedContext.azimuthDegrees ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Tipo montaje</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {getMountingBusinessLabel(estimateResult.usedContext.mountingType ?? undefined)}
                        </dd>
                      </div>
                    </dl>
                  )}
                  {estimateResult.annualGenerationKwh != null && (
                    <p className="pt-1 font-medium text-slate-800 dark:text-slate-200">
                      Generación anual: {estimateResult.annualGenerationKwh.toFixed(1)} kWh
                    </p>
                  )}
                  {!showEstimateFailure &&
                    estimateResult.annualGenerationKwh != null &&
                    (!estimateResult.monthlyGeneration || estimateResult.monthlyGeneration.length < 12) && (
                      <p className="pt-1 text-xs text-amber-800 dark:text-amber-200" role="status">
                        La API no entregó 12 valores mensuales (o falló el reparto). No podrá usar «Aplicar generación
                        mensual calculada» hasta tener serie completa; revise claves en servidor, potencia del sistema
                        (&gt; 0) para Minenergía, o use PVWatts como respaldo.
                      </p>
                    )}
                  {estimateResult.monthlyGeneration && estimateResult.monthlyGeneration.length > 0 && (
                    <div className="pt-1">
                      <p className="mb-1 text-slate-600 dark:text-slate-400">Generación mensual (kWh)</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                        {estimateResult.monthlyGeneration.map((m) => (
                          <span key={m.month}>
                            {m.label}: {Number(m.generationKwh).toFixed(0)}
                          </span>
                        ))}
                      </div>
                      {studyId && (
                        <ApplyGenerationButton
                          studyId={studyId}
                          formMonths={form.months}
                          monthlyGeneration={estimateResult.monthlyGeneration}
                          onApplied={() => {
                            setForm((prev) => ({
                              ...prev,
                              generationSource: "MANUAL",
                              months: prev.months.map((m) => ({
                                ...m,
                                generationKwh: (() => {
                                  const g = estimateResult.monthlyGeneration?.[m.monthIndex - 1]?.generationKwh;
                                  const n = Number(g);
                                  return Number.isFinite(n) ? n.toFixed(2) : "";
                                })(),
                              })),
                            }));
                          }}
                        />
                      )}
                    </div>
                  )}
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="card p-6">
        <h3 className="mb-2 text-lg font-medium text-slate-800">
          {form.generationSource === "MANUAL" ? "Consumos y generación mensual (kWh)" : "Consumos mensuales (kWh)"}
        </h3>
        <p className="mb-4 text-sm text-slate-600">
          {form.generationSource === "MANUAL"
            ? "Complete consumo y generación (kWh) para cada mes. Los valores de generación son obligatorios."
            : "Complete el consumo real (kWh) de cada mes. La generación se estimará internamente (promedio anual/12) al guardar."}
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-600">Mes</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-600">Consumo (kWh)</th>
                {form.generationSource === "MANUAL" && (
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-600">
                    Generación (kWh) <span className="text-red-600">*</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
              {form.months.map((m) => (
                <tr key={m.monthIndex}>
                  <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {MESES_NOMBRES[m.monthIndex - 1]}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      ref={(el) => {
                        consumptionInputRefs.current[m.monthIndex - 1] = el;
                      }}
                      type="text"
                      inputMode="decimal"
                      value={m.consumptionKwh}
                      onChange={(e) => updateMonth(m.monthIndex, e.target.value)}
                      onKeyDown={(e) => handleMonthConsumptionKeyDown(e, m.monthIndex)}
                      className="input-field w-28"
                      placeholder="Ej. 250"
                      aria-label={`Consumo ${MESES_NOMBRES[m.monthIndex - 1]} kWh`}
                    />
                  </td>
                  {form.generationSource === "MANUAL" && (
                    <td className="px-3 py-2">
                      <input
                        ref={(el) => {
                          generationInputRefs.current[m.monthIndex - 1] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        value={m.generationKwh}
                        onChange={(e) => updateMonthGeneration(m.monthIndex, e.target.value)}
                        onKeyDown={(e) => handleMonthGenerationKeyDown(e, m.monthIndex)}
                        className="input-field w-28"
                        placeholder="Ej. 180"
                        aria-required="true"
                        aria-label={`Generación ${MESES_NOMBRES[m.monthIndex - 1]} kWh`}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear estudio"}
        </button>
        <Link href={isEdit ? `/estudios-fv/${props.initial.id}` : "/estudios-fv"} className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
