"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectLocation } from "../../lib/api";

const ImplantationMapDynamic = dynamic(
  () =>
    import("../../app/estudios-fv/[id]/diseno-implantacion/ImplantationMap").then(
      (m) => m.ImplantationMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        Cargando mapa…
      </div>
    ),
  },
);

const DEFAULT_CENTER = { lat: -33.45, lng: -70.67 };
const DEFAULT_ZOOM = 16;

const KIND_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: "SITE", label: "Obra / destino", hint: "Ubicación principal del proyecto" },
  { id: "WAREHOUSE", label: "Bodega", hint: "Bodega propia o del proveedor" },
  { id: "TRANSIT", label: "Bodega transitoria", hint: "Acopio temporal / cross-docking" },
  { id: "YARD", label: "Faena / patio", hint: "Instalación de faena, patio u operación" },
  { id: "OTHER", label: "Otra", hint: "Ubicación adicional" },
];

function normalizeLat(raw: string): number | null {
  const n = raw.trim() ? Number(raw.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return null;
  if (n < -90 || n > 90) return null;
  return n;
}

function normalizeLng(raw: string): number | null {
  const n = raw.trim() ? Number(raw.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return null;
  if (n < -180 || n > 180) return null;
  return n;
}

export function ProjectLocationsModal({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: ProjectLocation[];
  onChange: (next: ProjectLocation[]) => void;
}) {
  const [draft, setDraft] = useState<ProjectLocation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchLat, setSearchLat] = useState("");
  const [searchLng, setSearchLng] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = value?.length
      ? value.map((x) => ({ ...x }))
      : ([
          {
            kind: "SITE",
            label: "Obra principal",
            address: "",
            latitude: null,
            longitude: null,
            notes: "",
            isPrimary: true,
          },
        ] satisfies ProjectLocation[]);
    setDraft(initial);
    setSelectedIdx(0);
    const p = initial.find((x) => x.isPrimary) ?? initial[0];
    setSearchLat(p?.latitude != null ? String(p.latitude) : "");
    setSearchLng(p?.longitude != null ? String(p.longitude) : "");
    setSearchAddress(p?.address ?? "");
    setSearchError(null);
  }, [open, value]);

  const selected = draft[selectedIdx] ?? null;

  const center = useMemo(() => {
    const lat = selected?.latitude ?? null;
    const lng = selected?.longitude ?? null;
    if (lat != null && lng != null) return { lat, lng };
    return DEFAULT_CENTER;
  }, [selected?.latitude, selected?.longitude]);

  const onPinMove = useCallback(
    (lat: number, lng: number) => {
      setDraft((prev) => {
        const next = [...prev];
        const cur = next[selectedIdx];
        if (!cur) return prev;
        next[selectedIdx] = { ...cur, latitude: lat, longitude: lng };
        return next;
      });
      setSearchLat(lat.toFixed(6));
      setSearchLng(lng.toFixed(6));
    },
    [selectedIdx],
  );

  const applyCoordinates = useCallback(() => {
    setSearchError(null);
    const lat = normalizeLat(searchLat);
    const lng = normalizeLng(searchLng);
    if (lat == null || lng == null) {
      setSearchError("Indique latitud y longitud válidas.");
      return;
    }
    onPinMove(lat, lng);
  }, [searchLat, searchLng, onPinMove]);

  const searchByAddress = useCallback(async () => {
    const q = searchAddress.trim();
    if (!q) {
      setSearchError("Escriba una dirección.");
      return;
    }
    setSearchError(null);
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { "Accept-Language": "es", "User-Agent": "SoftwareDeCotizaciones/1.0" } },
      );
      if (!res.ok) throw new Error("Error al buscar");
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      if (!data?.length || data[0].lat == null || data[0].lon == null) {
        setSearchError("No se encontró la dirección.");
        return;
      }
      const lat = Number.parseFloat(data[0].lat);
      const lng = Number.parseFloat(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setSearchError("Coordenadas no válidas.");
        return;
      }
      onPinMove(lat, lng);
      setSearchLat(lat.toFixed(6));
      setSearchLng(lng.toFixed(6));
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Error al buscar la dirección.");
    } finally {
      setGeocoding(false);
    }
  }, [searchAddress, onPinMove]);

  const addLocation = useCallback(() => {
    setDraft((prev) => {
      const next: ProjectLocation[] = [
        ...prev,
        {
          kind: "WAREHOUSE",
          label: "Nueva ubicación",
          address: "",
          latitude: null,
          longitude: null,
          notes: "",
          isPrimary: false,
        },
      ];
      return next;
    });
    setSelectedIdx(draft.length);
  }, [draft.length]);

  const removeSelected = useCallback(() => {
    setDraft((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== selectedIdx);
      if (!next.some((x) => x.isPrimary)) next[0] = { ...next[0]!, isPrimary: true };
      return next;
    });
    setSelectedIdx((i) => Math.max(0, Math.min(i - 1, draft.length - 2)));
  }, [selectedIdx, draft.length]);

  const makePrimary = useCallback(() => {
    setDraft((prev) => prev.map((x, i) => ({ ...x, isPrimary: i === selectedIdx })));
  }, [selectedIdx]);

  const save = useCallback(() => {
    const clean = draft
      .map((x, idx) => ({
        ...x,
        kind: String(x.kind ?? "SITE").trim() || "SITE",
        label: String(x.label ?? "").trim(),
        address: x.address != null ? String(x.address).trim() || null : null,
        notes: x.notes != null ? String(x.notes).trim() || null : null,
        latitude: x.latitude != null && Number.isFinite(Number(x.latitude)) ? Number(x.latitude) : null,
        longitude: x.longitude != null && Number.isFinite(Number(x.longitude)) ? Number(x.longitude) : null,
        isPrimary: Boolean(x.isPrimary) || idx === 0,
      }))
      .filter((x) => x.label);
    if (clean.length === 0) {
      setSearchError("Debe indicar al menos una ubicación con nombre.");
      return;
    }
    if (!clean.some((x) => x.isPrimary)) clean[0] = { ...clean[0]!, isPrimary: true };
    onChange(clean);
    onClose();
  }, [draft, onChange, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-[75] w-[min(100vw-24px,980px)] max-h-[min(92vh,820px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Ubicaciones del proyecto</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Dirección y coordenadas se sincronizan con el pin. Puede guardar varias ubicaciones (obra, bodegas, faena).
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

        <div className="grid max-h-[min(78vh,660px)] grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-12">
          <aside className="suite-scroll max-h-[min(78vh,660px)] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/40 lg:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Lista</p>
              <button
                type="button"
                onClick={addLocation}
                className="rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-950"
              >
                + Agregar
              </button>
            </div>
            {draft.map((x, i) => {
              const kindLabel = KIND_OPTIONS.find((k) => k.id === x.kind)?.label ?? x.kind;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedIdx(i)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    i === selectedIdx
                      ? "border-primary-400 bg-white shadow-sm dark:border-primary-500 dark:bg-slate-950"
                      : "border-slate-200 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-950"
                  }`}
                >
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {x.label?.trim() ? x.label : "Sin nombre"}
                    {x.isPrimary ? <span className="ml-2 text-[10px] font-bold text-primary-600">Principal</span> : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{kindLabel}</p>
                  {x.address?.trim() ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-300">{x.address}</p>
                  ) : null}
                </button>
              );
            })}
          </aside>

          <section className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:col-span-8">
            <div className="grid min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-12">
              <div className="space-y-2 lg:col-span-5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Nombre
                    <input
                      value={selected?.label ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => {
                          const next = [...prev];
                          if (!next[selectedIdx]) return prev;
                          next[selectedIdx] = { ...next[selectedIdx]!, label: e.target.value };
                          return next;
                        })
                      }
                      className="input-field-sm mt-1 w-full"
                      placeholder="Ej. Obra principal, Bodega Coyhaique…"
                    />
                  </label>
                  <label className="col-span-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Tipo
                    <select
                      value={selected?.kind ?? "SITE"}
                      onChange={(e) =>
                        setDraft((prev) => {
                          const next = [...prev];
                          if (!next[selectedIdx]) return prev;
                          next[selectedIdx] = { ...next[selectedIdx]!, kind: e.target.value };
                          return next;
                        })
                      }
                      className="select-field-sm mt-1 w-full"
                    >
                      {KIND_OPTIONS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Dirección
                  <div className="mt-1 flex gap-2">
                    <input
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                      className="input-field-sm w-full"
                      placeholder="Busque por dirección…"
                    />
                    <button
                      type="button"
                      onClick={() => void searchByAddress()}
                      disabled={geocoding}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                      {geocoding ? "Buscando…" : "Buscar"}
                    </button>
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Latitud
                    <input
                      value={searchLat}
                      onChange={(e) => setSearchLat(e.target.value)}
                      className="input-field-sm mt-1 w-full font-mono"
                      placeholder="-45.123456"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Longitud
                    <input
                      value={searchLng}
                      onChange={(e) => setSearchLng(e.target.value)}
                      className="input-field-sm mt-1 w-full font-mono"
                      placeholder="-72.123456"
                      inputMode="decimal"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyCoordinates}
                    className="col-span-2 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 dark:bg-primary-500"
                  >
                    Ir a coordenadas
                  </button>
                </div>

                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Observación
                  <textarea
                    value={selected?.notes ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => {
                        const next = [...prev];
                        if (!next[selectedIdx]) return prev;
                        next[selectedIdx] = { ...next[selectedIdx]!, notes: e.target.value };
                        return next;
                      })
                    }
                    className="input-field-sm mt-1 min-h-[64px] w-full"
                    rows={3}
                  />
                </label>

                {searchError ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                    {searchError}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={makePrimary}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Marcar principal
                  </button>
                  <button
                    type="button"
                    disabled={draft.length <= 1}
                    onClick={removeSelected}
                    className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-200 dark:hover:bg-rose-950/40"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="min-h-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:col-span-7">
                <ImplantationMapDynamic
                  centerLat={center.lat}
                  centerLng={center.lng}
                  zoom={DEFAULT_ZOOM}
                  className="min-h-[360px]"
                  locationPin={
                    selected?.latitude != null && selected?.longitude != null
                      ? { lat: selected.latitude, lng: selected.longitude }
                      : { lat: center.lat, lng: center.lng }
                  }
                  onLocationPinMove={onPinMove}
                  showStreetLabels
                />
              </div>
            </div>
          </section>
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
            onClick={save}
            className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 dark:bg-primary-500"
          >
            Guardar ubicaciones
          </button>
        </div>
      </div>
    </>
  );
}

