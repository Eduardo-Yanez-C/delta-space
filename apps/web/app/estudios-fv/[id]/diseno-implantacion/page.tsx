"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { useCan } from "../../../../lib/useCan";
import {
  deleteImplantationDesign,
  fetchFvStudy,
  fetchImplantationDesign,
  healthUrl,
  updateFvStudy,
  upsertImplantationDesign,
  uploadImplantationScreenshot,
  type FvStudy,
  type ImplantationDesign,
} from "../../../../lib/api";
import { toPng } from "html-to-image";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "./ImplantationMap";
import { polygonToGeoJson, geoJsonToPolygon, type LatLngTuple } from "./roofPolygonUtils";
import { computeBlockPlacements, rotatePointAroundCenter } from "./panelPlacementUtils";
import {
  polygonAreaM2,
  panelAreaTotalM2,
  occupancyPercent,
  roofBoundingBoxSpanMeters,
} from "./layoutMetrics";
import { PanelCatalogSelect, type SelectedPanelSnapshot } from "./PanelCatalogSelect";
import { panelDimensionsMmWithMeta } from "./panelDimensionsMm";
import { MOUNTING_TYPE_OPTIONS } from "../../constants";

function formatM2(value: number): string {
  return value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export type MapTool = "place" | "select" | "move" | "rotate";

function nextBlockId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type PlacementStateItem = {
  positionIndex: number;
  originLat: number;
  originLng: number;
  orientationDeg?: number;
  /** Modo H/V del rectángulo en planta para este placement; si falta, el mapa usa el modo global del diseño. */
  orientationMode?: "VERTICAL" | "HORIZONTAL";
  blockId?: string;
  stringId?: string | null;
};

const ImplantationMapDynamic = dynamic(
  () => import("./ImplantationMap").then((m) => m.ImplantationMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-600 dark:bg-slate-700/50">
        <span className="text-slate-500">Cargando mapa…</span>
      </div>
    ),
  },
);

export default function DisenoImplantacionPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const canRead = useCan("read", "fvStudy");
  const canEdit = useCan("edit", "fvStudy");
  const [study, setStudy] = useState<FvStudy | null>(null);
  const [design, setDesign] = useState<ImplantationDesign | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [roofPolygon, setRoofPolygon] = useState<LatLngTuple[] | null>(null);
  const [polygonMode, setPolygonMode] = useState<"draw" | "edit" | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(DEFAULT_ZOOM);

  const [selectedPanel, setSelectedPanel] = useState<SelectedPanelSnapshot | null>(null);
  const [panelOrientationMode, setPanelOrientationMode] = useState<"VERTICAL" | "HORIZONTAL">("HORIZONTAL");
  const [spacingHorizontalMm, setSpacingHorizontalMm] = useState<string>("20");
  const [spacingVerticalMm, setSpacingVerticalMm] = useState<string>("20");
  const [placementAngleDeg, setPlacementAngleDeg] = useState<string>("0");
  const [quantityX, setQuantityX] = useState<string>("1");
  const [quantityY, setQuantityY] = useState<string>("1");
  const [insertStringId, setInsertStringId] = useState<string>("");
  const [placements, setPlacements] = useState<PlacementStateItem[]>([]);
  const [activeTool, setActiveTool] = useState<MapTool>("select");
  const [selectedPlacementIds, setSelectedPlacementIds] = useState<number[]>([]);
  const [blockMetadata, setBlockMetadata] = useState<Record<string, { countX: number; countY: number }>>({});
  const [editBlockX, setEditBlockX] = useState("");
  const [editBlockY, setEditBlockY] = useState("");
  const [editBlockString, setEditBlockString] = useState("");
  const [editBlockOrientation, setEditBlockOrientation] = useState<"VERTICAL" | "HORIZONTAL">("HORIZONTAL");
  const [savingScreenshot, setSavingScreenshot] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchLat, setSearchLat] = useState("");
  const [searchLng, setSearchLng] = useState("");
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [clearingDesign, setClearingDesign] = useState(false);
  const [locationPin, setLocationPin] = useState<{ lat: number; lng: number } | null>(null);
  const [savingMountingType, setSavingMountingType] = useState(false);
  const [savingTilt, setSavingTilt] = useState(false);
  const [showStreetLabels, setShowStreetLabels] = useState(true);
  const panelClickHandledRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  /** Misma fuente que el resumen técnico + metadatos de normalización (escala en mapa). */
  const panelDimsMeta = useMemo(
    () => panelDimensionsMmWithMeta(selectedPanel, design),
    [selectedPanel, design],
  );
  const panelDimsMm = useMemo(
    () => ({ lengthMm: panelDimsMeta.lengthMm, widthMm: panelDimsMeta.widthMm }),
    [panelDimsMeta.lengthMm, panelDimsMeta.widthMm],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("DEBUG_IMPLANT") !== "1") return;
    const roof = roofPolygon && roofPolygon.length >= 3 ? roofBoundingBoxSpanMeters(roofPolygon) : null;
    // eslint-disable-next-line no-console
    console.debug("[implantación DEBUG]", {
      rawMm: { L: panelDimsMeta.rawLengthMm, W: panelDimsMeta.rawWidthMm },
      mapMm: { L: panelDimsMeta.lengthMm, W: panelDimsMeta.widthMm },
      normalization: panelDimsMeta.kind,
      metersOnMap: {
        L: panelDimsMeta.lengthMm / 1000,
        W: panelDimsMeta.widthMm / 1000,
      },
      roofBBoxM: roof,
    });
  }, [roofPolygon, panelDimsMeta]);

  const searchParams = useSearchParams();
  const returnToEdit = searchParams?.get("returnTo") === "edit";
  const backHref = id ? (returnToEdit ? `/estudios-fv/${id}/editar` : `/estudios-fv/${id}`) : "/estudios-fv";
  const backLabel = returnToEdit ? "Continuar con el estudio" : "Volver al estudio";

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDesign(undefined);
    Promise.all([fetchFvStudy(id), fetchImplantationDesign(id)])
      .then(([studyData, designData]) => {
        if (!cancelled) {
          setStudy(studyData);
          const d = designData ?? null;
          setDesign(d);
          const parsed = geoJsonToPolygon(d?.roofPolygonGeoJson ?? null);
          setRoofPolygon(parsed);
          if (d?.centerLat != null && d?.centerLng != null) {
            setMapCenter({ lat: d.centerLat, lng: d.centerLng });
            setMapZoom(d.zoom ?? DEFAULT_ZOOM);
            setLocationPin({ lat: d.centerLat, lng: d.centerLng });
          } else if (studyData.latitude != null && studyData.longitude != null) {
            setMapCenter({ lat: studyData.latitude, lng: studyData.longitude });
            setMapZoom(DEFAULT_ZOOM);
            setLocationPin({ lat: studyData.latitude, lng: studyData.longitude });
          } else {
            setMapCenter({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] });
            setMapZoom(4);
            setLocationPin(null);
          }
          if (d?.placements?.length) {
            const sorted = [...d.placements].sort((a, b) => a.positionIndex - b.positionIndex);
            const loadedOm =
              d?.panelOrientationMode === "VERTICAL" ? "VERTICAL" : "HORIZONTAL";
            setPlacements(
              sorted.map((p) => ({
                positionIndex: p.positionIndex,
                originLat: p.originLat,
                originLng: p.originLng,
                orientationDeg: p.orientationDeg ?? 0,
                orientationMode: loadedOm,
                stringId: p.stringId ?? undefined,
              })),
            );
            setBlockMetadata({});
          } else {
            setPlacements([]);
            setBlockMetadata({});
          }
          if (
            d?.panelLengthMmSnapshot != null &&
            d?.panelWidthMmSnapshot != null &&
            d.panelLengthMmSnapshot > 0 &&
            d.panelWidthMmSnapshot > 0
          ) {
            setSelectedPanel({
              productId: d.panelProductId ?? "",
              name: d.panelNameSnapshot ?? "Panel",
              powerW: d.panelPowerWSnapshot ?? 0,
              lengthMm: d.panelLengthMmSnapshot,
              widthMm: d.panelWidthMmSnapshot,
            });
          } else {
            setSelectedPanel(null);
          }
          setPanelOrientationMode(
            d?.panelOrientationMode === "VERTICAL" ? "VERTICAL" : "HORIZONTAL",
          );
          setSpacingHorizontalMm(
            d?.spacingHorizontalMm != null ? String(d.spacingHorizontalMm) : "20",
          );
          setSpacingVerticalMm(
            d?.spacingVerticalMm != null ? String(d.spacingVerticalMm) : "20",
          );
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  const handleMoveEnd = useCallback((center: { lat: number; lng: number }, zoom: number) => {
    setMapCenter(center);
    setMapZoom(zoom);
  }, []);

  const handlePolygonComplete = useCallback((points: LatLngTuple[]) => {
    setRoofPolygon(points);
    setPolygonMode(null);
  }, []);

  const handlePolygonEdit = useCallback((points: LatLngTuple[]) => {
    setRoofPolygon(points);
    setPolygonMode(null);
  }, []);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const lenMm = panelDimsMm.lengthMm;
      const widMm = panelDimsMm.widthMm;
      if (lenMm <= 0 || widMm <= 0) return;
      const angle = parseInt(placementAngleDeg, 10);
      const cx = Math.max(1, parseInt(quantityX, 10) || 1);
      const cy = Math.max(1, parseInt(quantityY, 10) || 1);
      const spacingH = Math.max(0, parseInt(spacingHorizontalMm, 10) || 0);
      const spacingV = Math.max(0, parseInt(spacingVerticalMm, 10) || 0);
      const angleDeg = Number.isFinite(angle) ? angle : 0;

      const blockId = nextBlockId();

      const stringId = insertStringId.trim() || undefined;
      if (cx === 1 && cy === 1) {
        setPlacements((prev) => {
          const startIdx = prev.length;
          const next = [
            ...prev,
            {
              positionIndex: startIdx,
              originLat: lat,
              originLng: lng,
              orientationDeg: angleDeg,
              orientationMode: panelOrientationMode,
              blockId,
              stringId,
            },
          ];
          setSelectedPlacementIds([startIdx]);
          return next;
        });
        setBlockMetadata((prev) => ({ ...prev, [blockId]: { countX: 1, countY: 1 } }));
        return;
      }

      const block = computeBlockPlacements(
        lat,
        lng,
        angleDeg,
        cx,
        cy,
        lenMm,
        widMm,
        spacingH,
        spacingV,
        panelOrientationMode,
      );
      setPlacements((prev) => {
        const startIdx = prev.length;
        const newIds: number[] = [];
        const next = [...prev];
        block.forEach((b, idx) => {
          const pi = startIdx + idx;
          newIds.push(pi);
          next.push({
            positionIndex: pi,
            originLat: b.originLat,
            originLng: b.originLng,
            orientationDeg: b.orientationDeg,
            orientationMode: b.orientationMode,
            blockId,
            stringId,
          });
        });
        setSelectedPlacementIds(newIds);
        return next;
      });
      setBlockMetadata((prev) => ({ ...prev, [blockId]: { countX: cx, countY: cy } }));
    },
    [
      panelDimsMm.lengthMm,
      panelDimsMm.widthMm,
      placementAngleDeg,
      quantityX,
      quantityY,
      spacingHorizontalMm,
      spacingVerticalMm,
      panelOrientationMode,
      insertStringId,
    ],
  );

  const handleRemoveLastPlacement = useCallback(() => {
    setPlacements((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  const handleRemoveLastBlock = useCallback(() => {
    const cx = Math.max(1, parseInt(quantityX, 10) || 1);
    const cy = Math.max(1, parseInt(quantityY, 10) || 1);
    const n = cx * cy;
    setPlacements((prev) => (prev.length >= n ? prev.slice(0, -n) : prev));
    setSelectedPlacementIds([]);
  }, [quantityX, quantityY]);

  const handlePanelClick = useCallback(
    (positionIndex: number) => {
      panelClickHandledRef.current = true;
      const placement = placements.find((p) => p.positionIndex === positionIndex);
      if (!placement) return;
      if (placement.blockId) {
        const ids = placements
          .filter((p) => p.blockId === placement.blockId)
          .map((p) => p.positionIndex);
        setSelectedPlacementIds(ids);
      } else {
        setSelectedPlacementIds([positionIndex]);
      }
    },
    [placements],
  );

  const handlePanelRightClick = useCallback((positionIndex: number) => {
    setPlacements((prev) => {
      const idx = prev.findIndex((p) => p.positionIndex === positionIndex);
      if (idx < 0) return prev;
      const next = prev.filter((_, i) => i !== idx).map((p, i) => ({
        ...p,
        positionIndex: i,
      }));
      setSelectedPlacementIds((sel) =>
        sel
          .filter((i) => i !== positionIndex)
          .map((i) => (i > positionIndex ? i - 1 : i)),
      );
      return next;
    });
  }, []);

  const handleMoveSelectionByDelta = useCallback(
    (dLat: number, dLng: number) => {
      if (selectedPlacementIds.length === 0) return;
      const ids = new Set(selectedPlacementIds);
      setPlacements((prev) =>
        prev.map((p) =>
          ids.has(p.positionIndex)
            ? {
                ...p,
                originLat: p.originLat + dLat,
                originLng: p.originLng + dLng,
              }
            : p,
        ),
      );
    },
    [selectedPlacementIds],
  );

  const handleRotateSelectionBy = useCallback(
    (deltaDeg: number) => {
      if (selectedPlacementIds.length === 0) return;
      const selected = placements.filter((p) =>
        selectedPlacementIds.includes(p.positionIndex),
      );
      const centerLat =
        selected.reduce((s, p) => s + p.originLat, 0) / selected.length;
      const centerLng =
        selected.reduce((s, p) => s + p.originLng, 0) / selected.length;
      const ids = new Set(selectedPlacementIds);
      setPlacements((prev) =>
        prev.map((p) => {
          if (!ids.has(p.positionIndex)) return p;
          const [newLat, newLng] = rotatePointAroundCenter(
            centerLat,
            centerLng,
            p.originLat,
            p.originLng,
            deltaDeg,
          );
          const newAngle = (p.orientationDeg ?? 0) + deltaDeg;
          return {
            ...p,
            originLat: newLat,
            originLng: newLng,
            orientationDeg: newAngle,
          };
        }),
      );
    },
    [placements, selectedPlacementIds],
  );

  useEffect(() => {
    if (activeTool !== "place") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      setActiveTool("select");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool]);

  const handleMapClickUnified = useCallback(
    (lat: number, lng: number) => {
      if (panelClickHandledRef.current) {
        panelClickHandledRef.current = false;
        return;
      }
      if (polygonMode === "draw" || polygonMode === "edit") {
        return;
      }
      if (activeTool === "place" && panelDimsMm.lengthMm > 0 && panelDimsMm.widthMm > 0) {
        handleMapClick(lat, lng);
        return;
      }
      setSelectedPlacementIds([]);
    },
    [activeTool, panelDimsMm.lengthMm, panelDimsMm.widthMm, handleMapClick, polygonMode],
  );

  const handleDeselect = useCallback(() => {
    setSelectedPlacementIds([]);
  }, []);

  const handleDeleteSelection = useCallback(() => {
    if (selectedPlacementIds.length === 0) return;
    const toRemove = new Set(selectedPlacementIds);
    setPlacements((prev) => {
      const next = prev.filter((p) => !toRemove.has(p.positionIndex));
      return next.map((p, i) => ({ ...p, positionIndex: i }));
    });
    setSelectedPlacementIds([]);
  }, [selectedPlacementIds]);

  const handleAssignSelectionToString = useCallback(
    (stringId: string | null) => {
      if (selectedPlacementIds.length === 0) return;
      const ids = new Set(selectedPlacementIds);
      setPlacements((prev) =>
        prev.map((p) =>
          ids.has(p.positionIndex)
            ? { ...p, stringId: stringId && stringId.trim() ? stringId.trim() : undefined }
            : p,
        ),
      );
    },
    [selectedPlacementIds],
  );

  /** Selecciona todos los paneles que pertenecen al string dado (para editarlos como grupo). */
  const handleSelectString = useCallback(
    (stringId: string) => {
      const sid = stringId.trim();
      const ids = placements
        .filter((p) => (p.stringId ?? "") === sid)
        .map((p) => p.positionIndex);
      setSelectedPlacementIds(ids);
      setActiveTool("select");
    },
    [placements],
  );

  /** Doble clic izquierdo en un panel: selecciona todo el string de ese panel; si no tiene stringId, mantiene selección individual. */
  const handlePanelDoubleClick = useCallback(
    (positionIndex: number) => {
      panelClickHandledRef.current = true;
      const placement = placements.find((p) => p.positionIndex === positionIndex);
      if (!placement) return;
      const sid = (placement.stringId ?? "").trim();
      if (sid) {
        handleSelectString(sid);
      }
      // Si no tiene stringId, no hacemos nada: el primer clic ya dejó seleccionado ese panel
    },
    [placements, handleSelectString],
  );

  useEffect(() => {
    if (selectedPlacementIds.length === 0) {
      setEditBlockX("");
      setEditBlockY("");
      setEditBlockString("");
      setEditBlockOrientation("HORIZONTAL");
      return;
    }
    const selected = placements.filter((p) =>
      selectedPlacementIds.includes(p.positionIndex),
    );
    const first = selected.reduce((a, b) =>
      a.positionIndex < b.positionIndex ? a : b,
    );
    const blockId = first.blockId;
    const meta = blockId ? blockMetadata[blockId] : null;
    const n = selected.length;
    const cx = meta?.countX ?? n;
    const cy = meta?.countY ?? 1;
    setEditBlockX(String(cx));
    setEditBlockY(String(cy));
    setEditBlockString(first.stringId ?? "");
    setEditBlockOrientation(first.orientationMode ?? panelOrientationMode);
  }, [selectedPlacementIds, placements, blockMetadata, panelOrientationMode]);

  const handleApplyBlockEdit = useCallback(() => {
    if (selectedPlacementIds.length === 0) return;
    const selected = placements.filter((p) =>
      selectedPlacementIds.includes(p.positionIndex),
    );
    const first = selected.reduce((a, b) =>
      a.positionIndex < b.positionIndex ? a : b,
    );
    const newX = Math.max(1, parseInt(editBlockX, 10) || 1);
    const newY = Math.max(1, parseInt(editBlockY, 10) || 1);
    const newString = editBlockString.trim() || null;
    const ids = new Set(selectedPlacementIds);
    const meta = first.blockId ? blockMetadata[first.blockId] : null;
    const currentX = meta?.countX ?? selected.length;
    const currentY = meta?.countY ?? 1;
    const shapeChanged = newX !== currentX || newY !== currentY;
    const currentOm = first.orientationMode ?? panelOrientationMode;
    const orientationChanged = editBlockOrientation !== currentOm;
    const layoutChanged = shapeChanged || orientationChanged;

    if (newString !== (first.stringId ?? "")) {
      handleAssignSelectionToString(newString);
    }

    if (layoutChanged) {
      const len = panelDimsMm.lengthMm;
      const wid = panelDimsMm.widthMm;
      const spacingH = Math.max(0, parseInt(spacingHorizontalMm, 10) || 0);
      const spacingV = Math.max(0, parseInt(spacingVerticalMm, 10) || 0);
      const angleDeg = first.orientationDeg ?? 0;
      const blockId = first.blockId ?? nextBlockId();

      if (len <= 0 || wid <= 0) return;

      const block = computeBlockPlacements(
        first.originLat,
        first.originLng,
        angleDeg,
        newX,
        newY,
        len,
        wid,
        spacingH,
        spacingV,
        editBlockOrientation,
      );
      setPlacements((prev) => {
        const kept = prev.filter((p) => !ids.has(p.positionIndex));
        const reindexed = kept.map((p, i) => ({ ...p, positionIndex: i }));
        const baseIdx = reindexed.length;
        block.forEach((b, idx) => {
          reindexed.push({
            positionIndex: baseIdx + idx,
            originLat: b.originLat,
            originLng: b.originLng,
            orientationDeg: b.orientationDeg,
            orientationMode: b.orientationMode,
            blockId,
            stringId: newString ?? undefined,
          });
        });
        return reindexed;
      });
      setBlockMetadata((prev) => ({
        ...prev,
        [blockId]: { countX: newX, countY: newY },
      }));
      const keptCount = placements.filter((p) => !ids.has(p.positionIndex)).length;
      setSelectedPlacementIds(block.map((_, i) => keptCount + i));
    }
  }, [
    selectedPlacementIds,
    placements,
    blockMetadata,
    editBlockX,
    editBlockY,
    editBlockString,
    editBlockOrientation,
    panelDimsMm.lengthMm,
    panelDimsMm.widthMm,
    spacingHorizontalMm,
    spacingVerticalMm,
    panelOrientationMode,
    handleAssignSelectionToString,
  ]);

  const handleSaveLayout = useCallback(async () => {
    if (!id || !study) return;
    setSaveError(null);
    setSaving(true);
    const center = mapCenter ?? { lat: study.latitude ?? DEFAULT_CENTER[0], lng: study.longitude ?? DEFAULT_CENTER[1] };
    const zoom = mapZoom ?? DEFAULT_ZOOM;
    const roofPolygonGeoJson = roofPolygon && roofPolygon.length >= 3 ? polygonToGeoJson(roofPolygon) : null;
    const placementsPayload = placements.map((p) => ({
      positionIndex: p.positionIndex,
      originLat: p.originLat,
      originLng: p.originLng,
      orientationDeg: p.orientationDeg ?? 0,
      stringId: p.stringId ?? null,
    }));
    const spacingH = parseInt(spacingHorizontalMm, 10);
    const spacingV = parseInt(spacingVerticalMm, 10);
    try {
      const updated = await upsertImplantationDesign(id, {
        centerLat: center.lat,
        centerLng: center.lng,
        zoom,
        roofPolygonGeoJson,
        panelProductId: selectedPanel?.productId ?? design?.panelProductId ?? null,
        panelNameSnapshot: selectedPanel?.name ?? design?.panelNameSnapshot ?? null,
        panelPowerWSnapshot: selectedPanel?.powerW ?? design?.panelPowerWSnapshot ?? null,
        panelWidthMmSnapshot: panelDimsMm.widthMm > 0 ? panelDimsMm.widthMm : null,
        panelLengthMmSnapshot: panelDimsMm.lengthMm > 0 ? panelDimsMm.lengthMm : null,
        panelOrientationMode,
        spacingHorizontalMm: Number.isFinite(spacingH) ? spacingH : null,
        spacingVerticalMm: Number.isFinite(spacingV) ? spacingV : null,
        placements: placementsPayload,
      });
      setDesign(updated);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [
    id,
    study,
    mapCenter,
    mapZoom,
    roofPolygon,
    placements,
    selectedPanel,
    design,
    panelDimsMm.lengthMm,
    panelDimsMm.widthMm,
    panelOrientationMode,
    spacingHorizontalMm,
    spacingVerticalMm,
  ]);

  const handleSaveScreenshot = useCallback(async () => {
    const el = mapContainerRef.current;
    if (!el) {
      setSaveError("No se puede capturar el mapa.");
      return;
    }
    if (!id || id.trim() === "") {
      setSaveError("Falta el ID del estudio. Recargue la página.");
      return;
    }
    setSaveError(null);
    setSavingScreenshot(true);
    try {
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 1,
        skipFonts: true,
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const updated = await uploadImplantationScreenshot(id, blob, "capture.png");
      setDesign(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar la captura";
      if (msg.includes("404") || msg.includes("Cannot POST") || msg.includes("Failed to fetch")) {
        setSaveError(
          `${msg} Compruebe que el backend está en ejecución (npm run start en apps/api) y que NEXT_PUBLIC_API_URL apunta a él (ej. http://localhost:4000/api). Pruebe en el navegador: ${healthUrl()}`,
        );
      } else {
        setSaveError(msg);
      }
    } finally {
      setSavingScreenshot(false);
    }
  }, [id]);

  const handleGoToCoordinates = useCallback(() => {
    setLocationSearchError(null);
    const lat = parseFloat(searchLat.replace(",", "."));
    const lng = parseFloat(searchLng.replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setLocationSearchError("Indique latitud y longitud válidas.");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setLocationSearchError("Latitud entre -90 y 90; longitud entre -180 y 180.");
      return;
    }
    setMapCenter({ lat, lng });
    setMapZoom(DEFAULT_ZOOM);
    setLocationPin({ lat, lng });
  }, [searchLat, searchLng]);

  const handleSearchAddress = useCallback(async () => {
    const q = searchAddress.trim();
    if (!q) {
      setLocationSearchError("Escriba una dirección.");
      return;
    }
    setLocationSearchError(null);
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { "Accept-Language": "es", "User-Agent": "SoftwareDeCotizaciones/1.0" } },
      );
      if (!res.ok) throw new Error("Error al buscar");
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      if (!data?.length || data[0].lat == null || data[0].lon == null) {
        setLocationSearchError("No se encontró la dirección.");
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationSearchError("Coordenadas no válidas.");
        return;
      }
      setMapCenter({ lat, lng });
      setMapZoom(DEFAULT_ZOOM);
      setLocationPin({ lat, lng });
      setSearchLat(lat.toFixed(6));
      setSearchLng(lng.toFixed(6));
    } catch (e) {
      setLocationSearchError(e instanceof Error ? e.message : "Error al buscar la dirección.");
    } finally {
      setGeocoding(false);
    }
  }, [searchAddress]);

  const handleSaveLocationToStudy = useCallback(async () => {
    const coords = locationPin ?? mapCenter ?? (study?.latitude != null && study?.longitude != null ? { lat: study.latitude, lng: study.longitude } : null);
    if (!id || !coords) return;
    setSaveError(null);
    setSavingLocation(true);
    try {
      await updateFvStudy(id, { latitude: coords.lat, longitude: coords.lng });
      setStudy((prev) => (prev ? { ...prev, latitude: coords.lat, longitude: coords.lng } : null));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar ubicación");
    } finally {
      setSavingLocation(false);
    }
  }, [id, locationPin, mapCenter, study]);

  const handleLocationPinMove = useCallback((lat: number, lng: number) => {
    setLocationPin({ lat, lng });
    setSearchLat(String(lat));
    setSearchLng(String(lng));
  }, []);

  const handleMountingTypeChange = useCallback(
    async (value: string) => {
      if (!id || !study) return;
      setSaveError(null);
      setSavingMountingType(true);
      try {
        await updateFvStudy(id, { mountingType: value || undefined });
        setStudy((prev) => (prev ? { ...prev, mountingType: value || null } : null));
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Error al guardar tipo de montaje");
      } finally {
        setSavingMountingType(false);
      }
    },
    [id, study],
  );

  const handleTiltDegreesChange = useCallback(
    async (value: string) => {
      if (!id || !study) return;
      const num = value.trim() === "" ? null : parseFloat(value.replace(",", "."));
      if (num !== null && !Number.isFinite(num)) return;
      setSaveError(null);
      setSavingTilt(true);
      try {
        await updateFvStudy(id, { tiltDegrees: num ?? undefined });
        setStudy((prev) => (prev ? { ...prev, tiltDegrees: num } : null));
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Error al guardar inclinación");
      } finally {
        setSavingTilt(false);
      }
    },
    [id, study],
  );

  const handleClearDesign = useCallback(async () => {
    if (!id || !study) return;
    if (!window.confirm("¿Borrar todo el diseño de implantación de este estudio? Se eliminarán polígono, paneles, strings y captura. No se puede deshacer.")) return;
    setSaveError(null);
    setClearingDesign(true);
    try {
      await deleteImplantationDesign(id);
      setDesign(null);
      setRoofPolygon(null);
      setPlacements([]);
      setSelectedPlacementIds([]);
      setBlockMetadata({});
      setPolygonMode(null);
      setSelectedPanel(null);
      if (study.latitude != null && study.longitude != null) {
        setMapCenter({ lat: study.latitude, lng: study.longitude });
        setMapZoom(DEFAULT_ZOOM);
        setLocationPin({ lat: study.latitude, lng: study.longitude });
      } else {
        setMapCenter({ lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] });
        setMapZoom(4);
        setLocationPin(null);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al limpiar el diseño");
    } finally {
      setClearingDesign(false);
    }
  }, [id, study]);

  useEffect(() => {
    const lat = mapCenter?.lat ?? study?.latitude ?? null;
    const lng = mapCenter?.lng ?? study?.longitude ?? null;
    if (lat != null && lng != null && searchLat === "" && searchLng === "") {
      setSearchLat(String(lat));
      setSearchLng(String(lng));
    }
  }, [mapCenter?.lat, mapCenter?.lng, study?.latitude, study?.longitude]);

  if (!canRead) return null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando…</span>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        {error ?? "Estudio no encontrado"}
        <Link href={backHref} className="btn-secondary mt-3 inline-block">
          {backLabel}
        </Link>
      </div>
    );
  }

  const centerLat =
    mapCenter?.lat ?? design?.centerLat ?? study.latitude ?? DEFAULT_CENTER[0];
  const centerLng =
    mapCenter?.lng ?? design?.centerLng ?? study.longitude ?? DEFAULT_CENTER[1];
  const zoom = mapZoom ?? design?.zoom ?? (study.latitude != null && study.longitude != null ? DEFAULT_ZOOM : 4);

  const hasSelection = selectedPlacementIds.length > 0;
  const selectionCentroid =
    hasSelection && placements.length > 0
      ? (() => {
          const selected = placements.filter((p) =>
            selectedPlacementIds.includes(p.positionIndex),
          );
          if (selected.length === 0) return null;
          return {
            lat: selected.reduce((s, p) => s + p.originLat, 0) / selected.length,
            lng: selected.reduce((s, p) => s + p.originLng, 0) / selected.length,
          };
        })()
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 py-1">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Diseño de implantación
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {study.title}
          </p>
        </div>
        <Link
          href={backHref}
          className="btn-secondary text-sm"
        >
          {backLabel}
        </Link>
      </div>

      {saveError && (
        <div className="shrink-0 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {saveError}
          <button type="button" onClick={() => setSaveError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:items-stretch">
        <div className="relative flex min-h-[min(280px,40vh)] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800 lg:min-h-0">
          <ImplantationMapDynamic
            mapContainerRef={mapContainerRef}
            centerLat={centerLat}
            centerLng={centerLng}
            zoom={zoom}
            className="min-h-0 flex-1"
            roofPolygon={roofPolygon}
            polygonMode={polygonMode}
            onPolygonComplete={handlePolygonComplete}
            onPolygonEdit={handlePolygonEdit}
            onMoveEnd={handleMoveEnd}
            placements={placements}
            panelLengthMm={panelDimsMm.lengthMm}
            panelWidthMm={panelDimsMm.widthMm}
            panelOrientationMode={panelOrientationMode}
            placeMode={activeTool === "place"}
            onMapClick={handleMapClickUnified}
            selectedPlacementIds={selectedPlacementIds}
            onPanelClick={handlePanelClick}
            onPanelDoubleClick={handlePanelDoubleClick}
            onPanelRightClick={handlePanelRightClick}
            rotationHandleCenter={
              activeTool === "rotate" && selectionCentroid ? selectionCentroid : null
            }
            onRotateSelection={handleRotateSelectionBy}
            activeTool={activeTool}
            onMoveSelectionByDelta={handleMoveSelectionByDelta}
            locationPin={locationPin}
            onLocationPinMove={handleLocationPinMove}
            showStreetLabels={showStreetLabels}
          />
          <div
            className="absolute bottom-2 left-2 right-2 z-[1000] flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white/95 px-3 py-2 shadow-md dark:border-slate-600 dark:bg-slate-800/95"
            role="toolbar"
            aria-label="Herramientas de edición"
          >
            {!hasSelection ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTool("place")}
                  className={`rounded border px-3 py-1.5 text-sm font-medium ${
                    activeTool === "place"
                      ? "border-green-600 bg-green-100 text-green-800 dark:border-green-500 dark:bg-green-900/40 dark:text-green-200"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                  title="Colocar: clic en mapa vacío inserta; clic en panel existente solo selecciona. Esc o Seleccionar para salir."
                >
                  Colocar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool("select")}
                  className={`rounded border px-3 py-1.5 text-sm font-medium ${
                    activeTool === "select"
                      ? "border-sky-600 bg-sky-100 text-sky-800 dark:border-sky-500 dark:bg-sky-900/40 dark:text-sky-200"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                  title="Seleccionar: clic en panel o bloque"
                >
                  Seleccionar
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {activeTool === "place"
                    ? "Mapa vacío = insertar · Panel existente = seleccionar · Esc sale del modo colocar"
                    : "Clic en vacío deselecciona"}
                </span>
                <span className="ml-2 border-l border-slate-300 pl-2 dark:border-slate-500" aria-hidden />
                <span className="text-xs text-slate-500 dark:text-slate-400">Vista:</span>
                <button
                  type="button"
                  onClick={() => setShowStreetLabels(false)}
                  className={`rounded border px-2 py-1 text-xs font-medium ${
                    !showStreetLabels
                      ? "border-slate-600 bg-slate-200 text-slate-800 dark:border-slate-400 dark:bg-slate-600 dark:text-slate-100"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                  title="Solo imagen satelital, sin nombres de calles"
                >
                  Satélite
                </button>
                <button
                  type="button"
                  onClick={() => setShowStreetLabels(true)}
                  className={`rounded border px-2 py-1 text-xs font-medium ${
                    showStreetLabels
                      ? "border-slate-600 bg-slate-200 text-slate-800 dark:border-slate-400 dark:bg-slate-600 dark:text-slate-100"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                  title="Satélite con nombres de calles y lugares"
                >
                  Satélite + calles
                </button>
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {selectedPlacementIds.length} seleccionado(s)
                </span>
                {activeTool === "place" && (
                  <span className="rounded border border-green-400 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800 dark:border-green-600 dark:bg-green-900/40 dark:text-green-200">
                    Modo colocar · vacío inserta · Esc sale
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTool("move")}
                  className={`rounded border px-3 py-1.5 text-sm font-medium ${
                    activeTool === "move"
                      ? "border-amber-600 bg-amber-100 text-amber-800 dark:border-amber-500 dark:bg-amber-900/40 dark:text-amber-200"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                  title="Mover: arrastrar la selección con el ratón"
                >
                  Mover
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool("rotate")}
                  className={`rounded border px-3 py-1.5 text-sm font-medium ${
                    activeTool === "rotate"
                      ? "border-violet-600 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-900/40 dark:text-violet-200"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                  title="Girar: arrastrar la manilla sobre la selección"
                >
                  Girar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelection}
                  className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeselect();
                    setActiveTool("select");
                  }}
                  className="rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Deseleccionar
                </button>
                <span className="ml-2 border-l border-slate-300 pl-2 dark:border-slate-500" aria-hidden />
                <span className="text-xs text-slate-500 dark:text-slate-400">Vista:</span>
                <button
                  type="button"
                  onClick={() => setShowStreetLabels(false)}
                  className={`rounded border px-2 py-1 text-xs font-medium ${
                    !showStreetLabels
                      ? "border-slate-600 bg-slate-200 text-slate-800 dark:border-slate-400 dark:bg-slate-600 dark:text-slate-100"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                  title="Solo imagen satelital"
                >
                  Satélite
                </button>
                <button
                  type="button"
                  onClick={() => setShowStreetLabels(true)}
                  className={`rounded border px-2 py-1 text-xs font-medium ${
                    showStreetLabels
                      ? "border-slate-600 bg-slate-200 text-slate-800 dark:border-slate-400 dark:bg-slate-600 dark:text-slate-100"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  }`}
                  title="Satélite con calles"
                >
                  Satélite + calles
                </button>
              </>
            )}
          </div>
        </div>

        <aside className="min-h-0 w-full max-h-[min(52vh,28rem)] shrink-0 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800/80 lg:h-full lg:max-h-full lg:w-72 lg:min-h-0">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Herramientas
          </h2>

          {/* Ubicación: buscar por dirección o coordenadas */}
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-800 dark:bg-sky-900/20">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
              Ubicación
            </h3>
            <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
              Busque la casa por dirección o ingrese coordenadas para centrar el mapa.
            </p>
            <div className="space-y-2">
              <div>
                <label htmlFor="search-address" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Dirección
                </label>
                <div className="flex gap-1">
                  <input
                    id="search-address"
                    type="text"
                    placeholder="Ej. Av. Providencia 1234, Santiago"
                    value={searchAddress}
                    onChange={(e) => setSearchAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchAddress()}
                    className="input-field flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSearchAddress}
                    disabled={geocoding}
                    className="shrink-0 rounded border border-sky-600 bg-sky-100 px-2 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-200 disabled:opacity-50 dark:border-sky-500 dark:bg-sky-900/50 dark:text-sky-200 dark:hover:bg-sky-900/70"
                  >
                    {geocoding ? "…" : "Buscar"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="search-lat" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Latitud
                  </label>
                  <input
                    id="search-lat"
                    type="text"
                    placeholder="-33.45"
                    value={searchLat}
                    onChange={(e) => setSearchLat(e.target.value)}
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="search-lng" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Longitud
                  </label>
                  <input
                    id="search-lng"
                    type="text"
                    placeholder="-70.67"
                    value={searchLng}
                    onChange={(e) => setSearchLng(e.target.value)}
                    className="input-field w-full text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleGoToCoordinates}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                Ir a coordenadas
              </button>
              {locationSearchError && (
                <p className="text-xs text-red-600 dark:text-red-400">{locationSearchError}</p>
              )}
              {canEdit && id && (
                <button
                  type="button"
                  onClick={handleSaveLocationToStudy}
                  disabled={savingLocation}
                  className="w-full rounded border border-green-600 bg-green-100 px-2 py-1.5 text-sm font-medium text-green-800 hover:bg-green-200 disabled:opacity-50 dark:border-green-700 dark:bg-green-900/40 dark:text-green-200 dark:hover:bg-green-900/60"
                >
                  {savingLocation ? "Guardando…" : "Guardar ubicación en el estudio"}
                </button>
              )}
            </div>
          </div>

          {/* Tipo de montaje (persistido en FvStudy, usado por recurso solar / Explorador Solar) */}
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/50">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tipo de montaje
            </h3>
            <select
              value={study?.mountingType ?? ""}
              onChange={(e) => handleMountingTypeChange(e.target.value)}
              disabled={!canEdit || savingMountingType}
              className="input-field w-full text-sm"
              aria-label="Tipo de montaje del estudio"
            >
              <option value="">—</option>
              {MOUNTING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {savingMountingType && (
              <p className="mt-1 text-xs text-slate-500">Guardando…</p>
            )}
          </div>

          {/* Inclinación real del panel (FvStudy.tiltDegrees). Distinta del ángulo en planta de los placements. */}
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/50">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Inclinación (°)
            </h3>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Ángulo de inclinación del panel respecto a la horizontal (0° horizontal, 90° vertical). Se guarda en el estudio.
            </p>
            <input
              type="number"
              min={0}
              max={90}
              step={0.5}
              value={study?.tiltDegrees != null ? String(study.tiltDegrees) : ""}
              onChange={(e) => {
                const v = e.target.value;
                setStudy((prev) =>
                  prev
                    ? { ...prev, tiltDegrees: v === "" ? null : parseFloat(v) || null }
                    : null,
                );
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === "" || Number.isFinite(parseFloat(v.replace(",", "."))))
                  handleTiltDegreesChange(v);
              }}
              disabled={!canEdit || savingTilt}
              placeholder="Ej. 25"
              className="input-field w-full text-sm"
              aria-label="Inclinación del panel en grados"
            />
            {savingTilt && (
              <p className="mt-1 text-xs text-slate-500">Guardando…</p>
            )}
          </div>

          {/* Resumen técnico / métricas del layout */}
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/50">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Resumen técnico
            </h3>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Área techo/paño:</dt>
                <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
                  {roofPolygon && roofPolygon.length >= 3
                    ? `${formatM2(polygonAreaM2(roofPolygon))} m²`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Cantidad paneles:</dt>
                <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
                  {placements.length}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Área total paneles:</dt>
                <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
                  {((): string => {
                    const len = panelDimsMm.lengthMm;
                    const wid = panelDimsMm.widthMm;
                    if (placements.length === 0 || len <= 0 || wid <= 0)
                      return "—";
                    const area = panelAreaTotalM2(placements.length, len, wid);
                    return `${formatM2(area)} m²`;
                  })()}
                </dd>
              </div>
              {roofPolygon &&
                roofPolygon.length >= 3 &&
                placements.length > 0 &&
                (() => {
                  const len = panelDimsMm.lengthMm;
                  const wid = panelDimsMm.widthMm;
                  if (len <= 0 || wid <= 0) return null;
                  const roofM2 = polygonAreaM2(roofPolygon);
                  const panelM2 = panelAreaTotalM2(placements.length, len, wid);
                  const occ = occupancyPercent(panelM2, roofM2);
                  return (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-600 dark:text-slate-400">
                        Ocupación:
                      </dt>
                      <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
                        {formatM2(occ)} %
                      </dd>
                    </div>
                  );
                })()}
              {placements.length > 0 && (
                <div className="flex flex-col gap-0.5 pt-1">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Ángulo en planta (orientación):
                  </dt>
                  <dd className="text-slate-800 dark:text-slate-200">
                    {(() => {
                      const angles = [
                        ...new Set(
                          placements.map((p) =>
                            Math.round(p.orientationDeg ?? 0),
                          ),
                        ),
                      ].sort((a, b) => a - b);
                      if (angles.length === 0) return "—";
                      if (angles.length <= 3)
                        return angles.map((a) => `${a}°`).join(", ");
                      return `${angles[0]}° … ${angles[angles.length - 1]}°`;
                    })()}
                  </dd>
                </div>
              )}
              {study && (
                <div className="flex justify-between gap-2 pt-1">
                  <dt className="text-slate-600 dark:text-slate-400">Inclinación (°):</dt>
                  <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-200">
                    {study.tiltDegrees != null ? `${study.tiltDegrees}°` : "—"}
                  </dd>
                </div>
              )}
              {placements.length > 0 && (() => {
                const byString: Record<string, number> = {};
                for (const p of placements) {
                  const sid = p.stringId ?? "";
                  byString[sid] = (byString[sid] ?? 0) + 1;
                }
                const entries = Object.entries(byString).filter(
                  ([k]) => k !== "",
                );
                if (entries.length === 0) return null;
                return (
                  <div className="flex flex-col gap-0.5 pt-1">
                    <dt className="text-slate-600 dark:text-slate-400">
                      Por string:
                    </dt>
                    <dd className="text-slate-800 dark:text-slate-200">
                      <ul className="space-y-1">
                        {entries
                          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                          .map(([sid, n]) => (
                            <li key={sid} className="flex flex-wrap items-center justify-between gap-1">
                              <span>
                                String {sid}: {n} panel{n !== 1 ? "es" : ""}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSelectString(sid)}
                                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                              >
                                Seleccionar
                              </button>
                            </li>
                          ))}
                      </ul>
                    </dd>
                  </div>
                );
              })()}
            </dl>
          </div>

          {/* Evidencia numérica: la fórmula mm→metros→grados es correcta; el fallo suele ser la magnitud (p. ej. 170 en vez de 1700 mm). */}
          <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/80 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
              Escala en mapa
            </h3>
            <dl className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {panelDimsMeta.lengthMm > 0 && panelDimsMeta.widthMm > 0 ? (
                <>
                  <div className="flex justify-between gap-2">
                    <dt>Valores crudos (BD/selector):</dt>
                    <dd className="font-medium tabular-nums">
                      {panelDimsMeta.rawLengthMm} × {panelDimsMeta.rawWidthMm} mm
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Usados para dibujar:</dt>
                    <dd className="font-medium tabular-nums text-indigo-900 dark:text-indigo-100">
                      {panelDimsMeta.lengthMm} × {panelDimsMeta.widthMm} mm
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Corrección de unidad:</dt>
                    <dd className="text-right">
                      {panelDimsMeta.kind === "none" && "Ninguna (÷1000 → metros en planta)"}
                      {panelDimsMeta.kind === "meters_as_mm" &&
                        "×1000 (decimales leídos como metros, p. ej. 1,7 → 1700 mm)"}
                      {panelDimsMeta.kind === "centimeters_as_mm" &&
                        "×10 (cm mal guardados como mm; p. ej. 170×113 → 1700×1130 mm)"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Rectángulo en planta (~):</dt>
                    <dd className="font-medium tabular-nums">
                      {(panelDimsMeta.lengthMm / 1000).toFixed(3)} ×{" "}
                      {(panelDimsMeta.widthMm / 1000).toFixed(3)} m
                    </dd>
                  </div>
                  {roofPolygon && roofPolygon.length >= 3
                    ? (() => {
                        const bb = roofBoundingBoxSpanMeters(roofPolygon);
                        const minRoof = Math.min(bb.widthM, bb.heightM);
                        const maxPanel = Math.max(
                          panelDimsMeta.lengthMm / 1000,
                          panelDimsMeta.widthMm / 1000,
                        );
                        const ratio = minRoof > 0 ? maxPanel / minRoof : 0;
                        return (
                          <>
                            <div className="flex justify-between gap-2">
                              <dt>Caja techo (aprox. N-S × E-O):</dt>
                              <dd className="tabular-nums">
                                {bb.heightM.toFixed(2)} × {bb.widthM.toFixed(2)} m
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt>Lado largo panel / lado corto caja techo:</dt>
                              <dd className="font-medium tabular-nums">
                                ~{(ratio * 100).toFixed(1)} %
                              </dd>
                            </div>
                            <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                              La conversión a lat/lng usa 1 m ≈ 1/111320° en N-S y cos(lat) en E-O (
                              <code className="text-[10px]">panelPlacementUtils</code>
                              ). Si el % es muy bajo y los crudos son ~170×113, era escala ×10 (cm→mm). Debug:{" "}
                              <code className="text-[10px]">localStorage.setItem(&quot;DEBUG_IMPLANT&quot;,&quot;1&quot;)</code>
                            </p>
                          </>
                        );
                      })()
                    : null}
                </>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  Seleccione un panel con dimensiones válidas.
                </p>
              )}
            </dl>
          </div>

          {hasSelection && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Bloque / selección
              </h3>
              <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                {selectedPlacementIds.length} panel(es). Edite X, Y, orientación H/V o string y pulse Aplicar.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="edit-block-x" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Cantidad X
                  </label>
                  <input
                    id="edit-block-x"
                    type="number"
                    min={1}
                    value={editBlockX}
                    onChange={(e) => setEditBlockX(e.target.value)}
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-block-y" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Cantidad Y
                  </label>
                  <input
                    id="edit-block-y"
                    type="number"
                    min={1}
                    value={editBlockY}
                    onChange={(e) => setEditBlockY(e.target.value)}
                    className="input-field w-full text-sm"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label htmlFor="edit-block-string" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  String
                </label>
                <select
                  id="edit-block-string"
                  className="input-field w-full text-sm"
                  value={editBlockString}
                  onChange={(e) => setEditBlockString(e.target.value)}
                >
                  <option value="">— Sin asignar —</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={String(n)}>
                      String {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Orientación del panel (largo/ancho en planta)
                </span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="editBlockPanelOrientation"
                      checked={editBlockOrientation === "HORIZONTAL"}
                      onChange={() => setEditBlockOrientation("HORIZONTAL")}
                      className="rounded border-slate-300"
                    />
                    Horizontal
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="editBlockPanelOrientation"
                      checked={editBlockOrientation === "VERTICAL"}
                      onChange={() => setEditBlockOrientation("VERTICAL")}
                      className="rounded border-slate-300"
                    />
                    Vertical
                  </label>
                </div>
              </div>
              {(() => {
                const selected = placements.filter((p) =>
                  selectedPlacementIds.includes(p.positionIndex),
                );
                const first = selected.reduce((a, b) =>
                  a.positionIndex < b.positionIndex ? a : b,
                );
                const ang = Math.round(first.orientationDeg ?? 0);
                return (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    Rotación en planta: {ang}° (no cambia con H/V; la inclinación del techo se edita arriba)
                  </p>
                );
              })()}
              <button
                type="button"
                onClick={handleApplyBlockEdit}
                className="mt-3 w-full rounded border border-amber-600 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200 dark:border-amber-500 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-900/70"
              >
                Aplicar cambios
              </button>
            </div>
          )}

          <div className="mb-4 space-y-3">
            <PanelCatalogSelect
              value={selectedPanel}
              onChange={setSelectedPanel}
              disabled={!canEdit}
            />
            {selectedPanel && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Panel actual: {selectedPanel.name}
                {selectedPanel.powerW > 0 ? ` (${selectedPanel.powerW} W)` : ""}
              </p>
            )}

            {activeTool === "place" && (
              <div className="rounded-lg border-2 border-green-200 bg-green-50/80 p-3 dark:border-green-800 dark:bg-green-900/20">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-200">
                  Configuración del bloque a colocar
                </h3>
                <p className="mb-2 text-xs text-green-800 dark:text-green-300">
                  Clic en el mapa vacío coloca el bloque. Clic en un panel ya colocado solo lo selecciona (no duplica). Pulsa Esc para salir de este modo.
                </p>
                <p className="mb-3 text-sm font-medium text-green-900 dark:text-green-100">
                  Insertar bloque {quantityX}×{quantityY} · Ángulo {placementAngleDeg}° ·{" "}
                  {panelOrientationMode === "HORIZONTAL" ? "Horizontal" : "Vertical"}
                  {insertStringId.trim() ? ` · String ${insertStringId.trim()}` : " · Sin string"}
                </p>
                <div className="space-y-3">
                  <div>
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Orientación del panel
                    </span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name="panelOrientation"
                          checked={panelOrientationMode === "HORIZONTAL"}
                          onChange={() => setPanelOrientationMode("HORIZONTAL")}
                          className="rounded border-slate-300"
                        />
                        Horizontal
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name="panelOrientation"
                          checked={panelOrientationMode === "VERTICAL"}
                          onChange={() => setPanelOrientationMode("VERTICAL")}
                          className="rounded border-slate-300"
                        />
                        Vertical
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="quantity-x" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Cantidad X
                      </label>
                      <input
                        id="quantity-x"
                        type="number"
                        min={1}
                        value={quantityX}
                        onChange={(e) => setQuantityX(e.target.value)}
                        className="input-field w-full text-sm"
                        title="Paneles en la dirección del largo"
                      />
                    </div>
                    <div>
                      <label htmlFor="quantity-y" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Cantidad Y
                      </label>
                      <input
                        id="quantity-y"
                        type="number"
                        min={1}
                        value={quantityY}
                        onChange={(e) => setQuantityY(e.target.value)}
                        className="input-field w-full text-sm"
                        title="Paneles en la dirección del ancho"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="placement-angle" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Ángulo en planta (°)
                    </label>
                    <input
                      id="placement-angle"
                      type="number"
                      min={-180}
                      max={360}
                      step={5}
                      value={placementAngleDeg}
                      onChange={(e) => setPlacementAngleDeg(e.target.value)}
                      className="input-field w-full text-sm"
                      title="0 = este, 90 = norte. Alinea el bloque con el techo."
                    />
                  </div>
                  <div>
                    <label htmlFor="insert-string" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      String del bloque
                    </label>
                    <select
                      id="insert-string"
                      className="input-field w-full text-sm"
                      value={insertStringId}
                      onChange={(e) => setInsertStringId(e.target.value)}
                    >
                      <option value="">— Sin asignar —</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={String(n)}>
                          String {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="spacing-h" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Separación H (mm)
                      </label>
                      <input
                        id="spacing-h"
                        type="number"
                        min={0}
                        value={spacingHorizontalMm}
                        onChange={(e) => setSpacingHorizontalMm(e.target.value)}
                        className="input-field w-full text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="spacing-v" className="mb-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Separación V (mm)
                      </label>
                      <input
                        id="spacing-v"
                        type="number"
                        min={0}
                        value={spacingVerticalMm}
                        onChange={(e) => setSpacingVerticalMm(e.target.value)}
                        className="input-field w-full text-sm"
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-center text-sm font-medium text-green-800 dark:text-green-200">
                  Haz clic en el mapa para insertar el bloque.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setPolygonMode((m) => (m === "draw" ? null : "draw"))}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                polygonMode === "draw"
                  ? "border-sky-500 bg-sky-50 text-sky-800 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {polygonMode === "draw" ? "Cancelar dibujo" : "Dibujar techo / paño"}
            </button>
            <button
              type="button"
              onClick={() => setPolygonMode((m) => (m === "edit" ? null : "edit"))}
              disabled={!roofPolygon || roofPolygon.length < 3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:disabled:hover:bg-slate-700"
            >
              {polygonMode === "edit" ? "Cancelar edición" : "Editar techo"}
            </button>
            <button
              type="button"
              onClick={() => setRoofPolygon(null)}
              disabled={!roofPolygon || roofPolygon.length < 3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:disabled:hover:bg-slate-700"
            >
              Borrar techo
            </button>
            <button
              type="button"
              onClick={handleSaveLayout}
              disabled={saving || !canEdit}
              className="w-full rounded-lg border border-amber-600 bg-amber-600 px-3 py-2 text-left text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 dark:border-amber-500 dark:bg-amber-600 dark:hover:bg-amber-700"
            >
              {saving ? "Guardando…" : "Guardar layout"}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Usa la barra de herramientas sobre el mapa: Colocar, Seleccionar, Mover, Girar.
            </p>
            <button
              type="button"
              onClick={handleRemoveLastPlacement}
              disabled={placements.length === 0}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:disabled:hover:bg-slate-700"
            >
              Quitar último panel
            </button>
            <button
              type="button"
              onClick={handleRemoveLastBlock}
              disabled={
                placements.length <
                Math.max(1, parseInt(quantityX, 10) || 1) * Math.max(1, parseInt(quantityY, 10) || 1)
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:disabled:hover:bg-slate-700"
              title="Quitar el último bloque completo (X×Y paneles según Cantidad X e Y)"
            >
              Quitar último bloque
            </button>
            {selectedPlacementIds.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {selectedPlacementIds.length} panel(es) seleccionado(s). Clic derecho sobre uno para eliminarlo. Edite string en el panel «Bloque / selección».
              </p>
            )}
            <button
              type="button"
              disabled={savingScreenshot}
              onClick={handleSaveScreenshot}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:disabled:hover:bg-slate-700"
              title="Captura la vista actual del mapa y la guarda como imagen del diseño"
            >
              {savingScreenshot ? "Guardando captura…" : "Guardar captura"}
            </button>
            <button
              type="button"
              disabled={clearingDesign || !canEdit}
              onClick={handleClearDesign}
              className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50 dark:disabled:hover:bg-red-900/30"
              title="Elimina polígono, paneles, strings y captura para empezar de cero"
            >
              {clearingDesign ? "Limpiando…" : "Limpiar diseño"}
            </button>
          </div>
          {design ? (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Diseño guardado. Zoom: {design.zoom}.
              {roofPolygon && roofPolygon.length >= 3 ? " Polígono de techo definido." : ""}
              {placements.length > 0 ? ` ${placements.length} panel(es).` : ""}
            </p>
          ) : (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Sin diseño guardado. Elija panel, dibuje el techo y guarde el layout.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
