"use client";

import { useEffect, useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { calculateFvPreview, type FvInput, type FvResult } from "../../../lib/fv-calculation";
import { fetchFvCalculation, saveFvCalculation, type QuoteFvCalculation } from "../../../lib/api";
import { CalculoFvResultado } from "./CalculoFvResultado";
import { CalculoFvGraficos } from "./CalculoFvGraficos";
import { PROJECT_TYPE_LABELS } from "../constants";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  versionId: string | null;
  quoteTitle: string;
  defaultCurrency: string;
  onSaved?: () => void;
};

const defaultInputs: FvInput = {
  consumoMensualKwh: 0,
  cuentaMensual: 0,
  valorKwhConsumo: 0,
  valorKwhInyeccion: 0,
  coberturaDeseada: 100,
  tipoProyecto: "RESIDENCIAL",
  potenciaPorPanelWp: 550,
};

export function CalculoFvModal({
  open,
  onClose,
  quoteId,
  versionId,
  quoteTitle,
  defaultCurrency,
  onSaved,
}: Props) {
  const [inputs, setInputs] = useState<FvInput & { consumoAnualKwh?: number; potenciaObjetivoKwp?: number; currency: string }>({
    ...defaultInputs,
    currency: defaultCurrency || "CLP",
  });
  const [previewResult, setPreviewResult] = useState<FvResult | null>(null);
  const [savedCalculation, setSavedCalculation] = useState<QuoteFvCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPreviewResult(null);
    setSavedCalculation(null);
    setInputs((prev) => ({ ...prev, currency: defaultCurrency || "CLP" }));
    if (quoteId && (versionId || versionId === null)) {
      setLoading(true);
      fetchFvCalculation(quoteId, versionId ?? undefined)
        .then((data) => {
          if (data) {
            setSavedCalculation(data);
            setInputs({
              consumoMensualKwh: data.consumoMensualKwh,
              consumoAnualKwh: data.consumoAnualKwh ?? undefined,
              cuentaMensual: data.cuentaMensual,
              valorKwhConsumo: data.valorKwhConsumo,
              valorKwhInyeccion: data.valorKwhInyeccion,
              coberturaDeseada: data.coberturaDeseada,
              tipoProyecto: data.tipoProyecto,
              potenciaObjetivoKwp: data.potenciaObjetivoKwp ?? undefined,
              potenciaPorPanelWp: data.potenciaPorPanelWp,
              currency: data.currency ?? defaultCurrency ?? "CLP",
            });
            setPreviewResult({
              plantaKwp: data.plantaKwp,
              cantidadPaneles: data.cantidadPaneles,
              generacionAnualKwh: data.generacionAnualKwh,
              generacionMensualKwh: data.generacionMensualKwh,
              ahorroMensual: data.ahorroMensual,
              ahorroAnual: data.ahorroAnual,
              porcentajeAhorro: data.porcentajeAhorro,
              pagoResidual: data.pagoResidual,
              hspDailyUsed: data.hspDailyUsed,
              performanceRatioUsed: data.performanceRatioUsed,
              calculationMethodVersion: data.calculationMethodVersion,
            });
          }
        })
        .catch(() => setSavedCalculation(null))
        .finally(() => setLoading(false));
    }
  }, [open, quoteId, versionId, defaultCurrency]);

  const handleCalculate = () => {
    setError(null);
    const consumoAnual = inputs.consumoAnualKwh ?? (inputs.consumoMensualKwh ? inputs.consumoMensualKwh * 12 : 0);
    if (!consumoAnual || consumoAnual <= 0) {
      setError("Ingrese consumo mensual o consumo anual para calcular.");
      return;
    }
    if (inputs.potenciaPorPanelWp <= 0) {
      setError("La potencia por panel debe ser mayor a 0.");
      return;
    }
    const input: FvInput = {
      consumoMensualKwh: inputs.consumoMensualKwh,
      consumoAnualKwh: inputs.consumoAnualKwh,
      cuentaMensual: inputs.cuentaMensual,
      valorKwhConsumo: inputs.valorKwhConsumo,
      valorKwhInyeccion: inputs.valorKwhInyeccion,
      coberturaDeseada: inputs.coberturaDeseada,
      tipoProyecto: inputs.tipoProyecto,
      potenciaObjetivoKwp: inputs.potenciaObjetivoKwp,
      potenciaPorPanelWp: inputs.potenciaPorPanelWp,
    };
    try {
      const result = calculateFvPreview(input);
      setPreviewResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al calcular");
    }
  };

  const handleSave = () => {
    setError(null);
    setSaving(true);
    const body = {
      consumoMensualKwh: inputs.consumoMensualKwh,
      consumoAnualKwh: inputs.consumoAnualKwh,
      cuentaMensual: inputs.cuentaMensual,
      valorKwhConsumo: inputs.valorKwhConsumo,
      valorKwhInyeccion: inputs.valorKwhInyeccion,
      coberturaDeseada: inputs.coberturaDeseada,
      tipoProyecto: inputs.tipoProyecto,
      potenciaObjetivoKwp: inputs.potenciaObjetivoKwp,
      potenciaPorPanelWp: inputs.potenciaPorPanelWp,
      currency: inputs.currency,
      quoteVersionId: versionId ?? undefined,
    };
    saveFvCalculation(quoteId, body)
      .then((data) => {
        setSavedCalculation(data);
        setPreviewResult({
          plantaKwp: data.plantaKwp,
          cantidadPaneles: data.cantidadPaneles,
          generacionAnualKwh: data.generacionAnualKwh,
          generacionMensualKwh: data.generacionMensualKwh,
          ahorroMensual: data.ahorroMensual,
          ahorroAnual: data.ahorroAnual,
          porcentajeAhorro: data.porcentajeAhorro,
          pagoResidual: data.pagoResidual,
          hspDailyUsed: data.hspDailyUsed,
          performanceRatioUsed: data.performanceRatioUsed,
          calculationMethodVersion: data.calculationMethodVersion,
        });
        onSaved?.();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al guardar"))
      .finally(() => setSaving(false));
  };

  const resultToShow = previewResult ?? (savedCalculation ? {
    plantaKwp: savedCalculation.plantaKwp,
    cantidadPaneles: savedCalculation.cantidadPaneles,
    generacionAnualKwh: savedCalculation.generacionAnualKwh,
    generacionMensualKwh: savedCalculation.generacionMensualKwh,
    ahorroMensual: savedCalculation.ahorroMensual,
    ahorroAnual: savedCalculation.ahorroAnual,
    porcentajeAhorro: savedCalculation.porcentajeAhorro,
    pagoResidual: savedCalculation.pagoResidual,
    hspDailyUsed: savedCalculation.hspDailyUsed,
    performanceRatioUsed: savedCalculation.performanceRatioUsed,
    calculationMethodVersion: savedCalculation.calculationMethodVersion,
  } : null);
  const currency = inputs.currency || "CLP";

  return (
    <Modal open={open} onClose={onClose} title={`Cálculo fotovoltaico — ${quoteTitle}`} maxWidth="xl">
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>
        )}
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-400">
          Cálculo rápido en cotización. Para un estudio completo con 12 meses, use <strong>Estudios FV</strong> desde el cliente.
        </p>
        {loading && <p className="text-sm text-slate-500">Cargando último cálculo…</p>}

        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Consumo y tarifa</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Consumo mensual (kWh)</label>
              <input
                type="number"
                min={0}
                step={1}
                className="input-field"
                value={inputs.consumoMensualKwh || ""}
                onChange={(e) => setInputs((p) => ({ ...p, consumoMensualKwh: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Consumo anual (kWh) — opcional</label>
              <input
                type="number"
                min={0}
                step={1}
                className="input-field"
                placeholder="Opcional; tiene prioridad sobre consumo mensual"
                value={inputs.consumoAnualKwh ?? ""}
                onChange={(e) => setInputs((p) => ({ ...p, consumoAnualKwh: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Cuenta mensual</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input-field"
                value={inputs.cuentaMensual || ""}
                onChange={(e) => setInputs((p) => ({ ...p, cuentaMensual: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Valor kWh consumo</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input-field"
                value={inputs.valorKwhConsumo || ""}
                onChange={(e) => setInputs((p) => ({ ...p, valorKwhConsumo: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Valor kWh inyección</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input-field"
                value={inputs.valorKwhInyeccion || ""}
                onChange={(e) => setInputs((p) => ({ ...p, valorKwhInyeccion: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Moneda</label>
              <select
                className="input-field"
                value={inputs.currency}
                onChange={(e) => setInputs((p) => ({ ...p, currency: e.target.value }))}
              >
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Planta y cobertura</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Cobertura deseada (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                className="input-field"
                value={inputs.coberturaDeseada ?? 100}
                onChange={(e) => setInputs((p) => ({ ...p, coberturaDeseada: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Potencia por panel (Wp)</label>
              <input
                type="number"
                min={1}
                step={10}
                className="input-field"
                value={inputs.potenciaPorPanelWp || ""}
                onChange={(e) => setInputs((p) => ({ ...p, potenciaPorPanelWp: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Potencia objetivo (kWp) — opcional</label>
              <input
                type="number"
                min={0}
                step={0.1}
                className="input-field"
                placeholder="Opcional; fija la potencia en kWp"
                value={inputs.potenciaObjetivoKwp ?? ""}
                onChange={(e) => setInputs((p) => ({ ...p, potenciaObjetivoKwp: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Tipo de proyecto</label>
              <select
                className="input-field"
                value={inputs.tipoProyecto}
                onChange={(e) => setInputs((p) => ({ ...p, tipoProyecto: e.target.value }))}
              >
                {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button type="button" onClick={handleCalculate} className="btn-primary">
            Calcular
          </button>
          {resultToShow && (
            <button type="button" onClick={handleSave} disabled={saving} className="btn-secondary">
              {saving ? "Guardando…" : "Guardar en cotización"}
            </button>
          )}
        </div>

        {resultToShow && (
          <>
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Resultados</h3>
              <CalculoFvResultado
                result={resultToShow}
                currency={currency}
                showAssumptions={!!savedCalculation || !!previewResult}
              />
            </section>
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Gráficos</h3>
              <CalculoFvGraficos
                result={resultToShow}
                consumoMensualKwh={
                  inputs.consumoAnualKwh != null && inputs.consumoAnualKwh > 0
                    ? inputs.consumoAnualKwh / 12
                    : inputs.consumoMensualKwh
                }
                cuentaMensual={inputs.cuentaMensual}
                currency={currency}
              />
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
