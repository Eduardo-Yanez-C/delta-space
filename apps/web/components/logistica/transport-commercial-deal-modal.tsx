"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchPublishedTransportContractVersions,
  fetchTransportCommercialTariffs,
  upsertTransportGroupCommercial,
  type InventoryTransportOverviewGroup,
  type PublishedContractVersionOption,
  type TransportCommercialTariff,
  type TransportGroupCommercialDeal,
} from "../../lib/api";

function commercialGroupKey(projectId: string, palletId: string | null): string {
  const pk = (palletId ?? "").trim() || "_sin_pallet";
  return `${projectId.trim()}|${pk}`;
}

function formatMoney(n: number, currency: string): string {
  const c = (currency || "CLP").trim() || "CLP";
  try {
    if (c === "CLP" || c === "EUR" || c === "USD") {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: c,
        maximumFractionDigits: c === "CLP" ? 0 : 2,
      }).format(n);
    }
  } catch {
    /* fall through */
  }
  return `${n.toLocaleString("es-CL")} ${c}`;
}

function suggestedFromBase(base: number, fuelPct: number | null | undefined): number {
  const pct = fuelPct == null || Number.isNaN(fuelPct) ? 0 : fuelPct;
  return Math.round(base * (1 + pct / 100) * 100) / 100;
}

export function TransportCommercialDealModal({
  open,
  onClose,
  group,
  initialDeal,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  group: InventoryTransportOverviewGroup | null;
  initialDeal: TransportGroupCommercialDeal | null | undefined;
  onSaved: (deal: TransportGroupCommercialDeal) => void;
}) {
  const projectId = group?.project?.id?.trim() ?? "";
  const palletId = group?.palletId ?? null;
  const gk = projectId ? commercialGroupKey(projectId, palletId) : "";

  const [tariffs, setTariffs] = useState<TransportCommercialTariff[]>([]);
  const [tariffsLoading, setTariffsLoading] = useState(false);
  const [tariffsError, setTariffsError] = useState<string | null>(null);
  const [publishedVersions, setPublishedVersions] = useState<PublishedContractVersionOption[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const [linkMode, setLinkMode] = useState<"none" | "tariff" | "contract">("none");
  const [tariffId, setTariffId] = useState<string>("");
  const [contractVersionId, setContractVersionId] = useState<string>("");
  const [fuelPct, setFuelPct] = useState<string>("");
  const [agreed, setAgreed] = useState<string>("");
  const [currency, setCurrency] = useState("CLP");
  const [manualPrice, setManualPrice] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tariffById = useMemo(
    () => new Map(tariffs.map((t) => [t.id, t])),
    [tariffs],
  );

  const selectedTariff = tariffId ? tariffById.get(tariffId) ?? null : null;
  const selectedContractVersion = useMemo(
    () => publishedVersions.find((v) => v.id === contractVersionId) ?? null,
    [publishedVersions, contractVersionId],
  );

  const baseForCalc = useMemo(() => {
    if (linkMode === "contract" && selectedContractVersion?.items?.length) {
      const itemSum = selectedContractVersion.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
      const addSum = (selectedContractVersion.overrides ?? [])
        .filter((o) => (o.action ?? "").toUpperCase() === "ADDITION")
        .reduce((s, o) => s + (Number(o.amount) || 0), 0);
      return itemSum + addSum;
    }
    if (linkMode === "tariff" && selectedTariff) return selectedTariff.baseAmount;
    if (
      linkMode === "tariff" &&
      initialDeal?.templateBaseSnapshot != null &&
      tariffId === (initialDeal.tariffId ?? "")
    ) {
      return initialDeal.templateBaseSnapshot;
    }
    if (
      linkMode === "contract" &&
      initialDeal?.templateBaseSnapshot != null &&
      contractVersionId === (initialDeal.contractVersionId ?? "")
    ) {
      return initialDeal.templateBaseSnapshot;
    }
    return 0;
  }, [
    linkMode,
    selectedContractVersion,
    selectedTariff,
    initialDeal,
    tariffId,
    contractVersionId,
  ]);

  const fuelNum = useMemo(() => {
    const t = fuelPct.trim();
    if (t === "") return null;
    const n = parseFloat(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }, [fuelPct]);

  const suggested = useMemo(() => {
    if (!baseForCalc || baseForCalc <= 0) return null;
    return suggestedFromBase(baseForCalc, fuelNum);
  }, [baseForCalc, fuelNum]);

  useEffect(() => {
    if (!open || !projectId) return;
    setTariffsLoading(true);
    setTariffsError(null);
    void fetchTransportCommercialTariffs({ projectId })
      .then(setTariffs)
      .catch((e) =>
        setTariffsError(e instanceof Error ? e.message : "Error al cargar plantillas"),
      )
      .finally(() => setTariffsLoading(false));
  }, [open, projectId]);

  useEffect(() => {
    if (!open || !projectId) return;
    setVersionsLoading(true);
    setVersionsError(null);
    void fetchPublishedTransportContractVersions({ projectId })
      .then(setPublishedVersions)
      .catch((e) =>
        setVersionsError(e instanceof Error ? e.message : "Error al cargar contratos"),
      )
      .finally(() => setVersionsLoading(false));
  }, [open, projectId]);

  useEffect(() => {
    if (!open || !group) return;
    const d = initialDeal;
    if (d?.contractVersionId) {
      setLinkMode("contract");
      setContractVersionId(d.contractVersionId);
      setTariffId("");
    } else if (d?.tariffId) {
      setLinkMode("tariff");
      setTariffId(d.tariffId);
      setContractVersionId("");
    } else {
      setLinkMode("none");
      setTariffId("");
      setContractVersionId("");
    }
    setFuelPct(
      d?.fuelSurchargePercent != null && !Number.isNaN(d.fuelSurchargePercent)
        ? String(d.fuelSurchargePercent)
        : "",
    );
    setAgreed(d?.agreedAmount != null ? String(d.agreedAmount) : "");
    setCurrency((d?.currency ?? "CLP").trim() || "CLP");
    setManualPrice(Boolean(d?.manualPrice));
    setNotes(d?.commercialNotes ?? "");
    setStatus((d?.commercialStatus ?? "DRAFT").trim() || "DRAFT");
    setSaveError(null);
  }, [open, group, initialDeal]);

  useEffect(() => {
    if (!open || manualPrice) return;
    if (suggested != null) setAgreed(String(suggested));
  }, [open, manualPrice, suggested]);

  const applyTariffDefaults = useCallback(
    (tid: string) => {
      const t = tariffById.get(tid);
      if (!t) {
        setFuelPct("");
        return;
      }
      setCurrency((t.currency || "CLP").trim() || "CLP");
      const fpct = t.fuelAdjustmentPercent;
      setFuelPct(fpct != null ? String(fpct) : "");
      if (!manualPrice) {
        const calc = suggestedFromBase(t.baseAmount, fpct);
        setAgreed(String(calc));
      }
    },
    [tariffById, manualPrice],
  );

  const onSave = useCallback(async () => {
    if (!projectId || !gk) return;
    setSaving(true);
    setSaveError(null);
    try {
      const agreedNum =
        agreed.trim() === "" ? null : parseFloat(agreed.trim().replace(",", "."));
      if (agreedNum != null && (Number.isNaN(agreedNum) || agreedNum < 0)) {
        throw new Error("Monto acordado inválido.");
      }
      const fuel =
        fuelPct.trim() === "" ? null : parseFloat(fuelPct.trim().replace(",", "."));
      if (fuel != null && Number.isNaN(fuel)) throw new Error("% combustible inválido.");
      const tId =
        linkMode === "tariff" && tariffId.trim() ? tariffId.trim() : null;
      const cvId =
        linkMode === "contract" && contractVersionId.trim() ? contractVersionId.trim() : null;
      const deal = await upsertTransportGroupCommercial({
        groupKey: gk,
        projectId,
        palletId,
        tariffId: tId,
        contractVersionId: cvId,
        fuelSurchargePercent: fuel,
        agreedAmount: agreedNum,
        currency,
        manualPrice,
        commercialNotes: notes.trim() || null,
        commercialStatus: status.trim() || "DRAFT",
      });
      onSaved(deal);
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [
    projectId,
    gk,
    palletId,
    linkMode,
    tariffId,
    contractVersionId,
    fuelPct,
    agreed,
    currency,
    manualPrice,
    notes,
    status,
    onSaved,
    onClose,
  ]);

  if (!open || !group || !projectId) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[88] bg-slate-900/50 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-[90] w-[min(100vw-24px,520px)] max-h-[min(90vh,640px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Acuerdo comercial (viaje / pallet)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {group.project?.code ?? "—"} · {group.palletId ?? "Sin pallet"} — Plantilla rápida, contrato publicado o precio manual.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            ✕
          </button>
        </div>

        <div className="suite-scroll max-h-[min(72vh,540px)] space-y-3 overflow-y-auto p-4">
          {tariffsError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {tariffsError}
            </div>
          ) : null}
          {saveError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {saveError}
            </div>
          ) : null}

          <fieldset className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <legend className="px-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
              Referencia de precio
            </legend>
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="linkMode"
                  checked={linkMode === "none"}
                  onChange={() => {
                    setLinkMode("none");
                    setTariffId("");
                    setContractVersionId("");
                  }}
                />
                Sin referencia
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="linkMode"
                  checked={linkMode === "tariff"}
                  onChange={() => {
                    setLinkMode("tariff");
                    setContractVersionId("");
                  }}
                />
                Plantilla rápida
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="linkMode"
                  checked={linkMode === "contract"}
                  onChange={() => {
                    setLinkMode("contract");
                    setTariffId("");
                  }}
                />
                Contrato publicado
              </label>
            </div>
          </fieldset>

          {linkMode === "tariff" ? (
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Plantilla
              <select
                className="select-field-sm mt-1 w-full"
                value={tariffId}
                disabled={tariffsLoading}
                onChange={(e) => {
                  const v = e.target.value;
                  setTariffId(v);
                  applyTariffDefaults(v);
                }}
              >
                <option value="">— Elija plantilla —</option>
                {tariffs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                    {t.supplier?.name ? ` · ${t.supplier.name}` : ""} (
                    {formatMoney(t.baseAmount, t.currency)})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {linkMode === "tariff" && tariffsLoading ? (
            <p className="text-xs text-slate-500">Cargando plantillas…</p>
          ) : null}

          {linkMode === "contract" ? (
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Versión publicada (suma ítems tarifario)
              <select
                className="select-field-sm mt-1 w-full"
                value={contractVersionId}
                disabled={versionsLoading}
                onChange={(e) => setContractVersionId(e.target.value)}
              >
                <option value="">— Elija contrato / versión —</option>
                {publishedVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.contract.title} · v{v.versionNumber} · {v.contract.supplier.name}
                    {v.contract.project ? ` · ${v.contract.project.code}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {linkMode === "contract" && versionsError ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">{versionsError}</p>
          ) : null}
          {linkMode === "contract" && versionsLoading ? (
            <p className="text-xs text-slate-500">Cargando contratos publicados…</p>
          ) : null}

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            % Combustible / ajuste sobre base
            <input
              type="text"
              inputMode="decimal"
              className="input-field-sm mt-1 w-full"
              placeholder="Ej. 5 o -2"
              value={fuelPct}
              onChange={(e) => setFuelPct(e.target.value)}
            />
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/50">
            <p className="font-semibold text-slate-700 dark:text-slate-200">Referencia</p>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              Base (plantilla o suma tarifario contrato):{" "}
              {baseForCalc > 0 ? formatMoney(baseForCalc, currency) : "—"}
            </p>
            <p className="mt-0.5 text-slate-600 dark:text-slate-400">
              Calculado (base × (1 + %)):{" "}
              {suggested != null ? formatMoney(suggested, currency) : "—"}
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={manualPrice}
              onChange={(e) => {
                const m = e.target.checked;
                setManualPrice(m);
                if (!m && suggested != null) setAgreed(String(suggested));
              }}
            />
            Precio acordado manual (no sigue el calculado)
          </label>

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Monto acordado
            <input
              type="text"
              inputMode="decimal"
              className="input-field-sm mt-1 w-full"
              value={agreed}
              onChange={(e) => setAgreed(e.target.value)}
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

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Estado comercial
            <select
              className="select-field-sm mt-1 w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="DRAFT">Borrador</option>
              <option value="SUBMITTED">Enviado / cotizado</option>
              <option value="AGREED">Acordado</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Notas comerciales
            <textarea
              className="input-field-sm mt-1 min-h-[72px] w-full resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condiciones, contrato, variación de ruta…"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500"
          >
            {saving ? "Guardando…" : "Guardar acuerdo"}
          </button>
        </div>
      </div>
    </>
  );
}
