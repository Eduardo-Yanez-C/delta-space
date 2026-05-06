"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon in bundlers (Next.js) where the default path is broken
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}
import { RoofPolygonDrawEdit } from "./RoofPolygonDrawEdit";
import { PanelPlacementsLayer, type PlacementItem } from "./PanelPlacementsLayer";
import type { LatLngTuple } from "./roofPolygonUtils";

// ESRI World Imagery (satellite). Atribución requerida.
const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const ESRI_SAT_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// CartoDB/CARTO: capa solo etiquetas (nombres de calles, lugares) para superponer sobre satélite.
const CARTO_LABELS_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const CARTO_LABELS_URL = "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png";

const DEFAULT_CENTER: [number, number] = [-33.45, -70.67];
const DEFAULT_ZOOM = 16;

type MapUpdaterProps = {
  center: [number, number];
  zoom: number;
};

function MapUpdater({ center, zoom }: MapUpdaterProps) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center[0], center[1], zoom]);
  return null;
}

type MapMoveReporterProps = {
  onMoveEnd: (center: { lat: number; lng: number }, zoom: number) => void;
};

function MapMoveReporter({ onMoveEnd }: MapMoveReporterProps) {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      const center = map.getCenter();
      onMoveEnd({ lat: center.lat, lng: center.lng }, map.getZoom());
    };
    map.on("moveend", handler);
    map.on("zoomend", handler);
    return () => {
      map.off("moveend", handler);
      map.off("zoomend", handler);
    };
  }, [map, onMoveEnd]);
  return null;
}

type MapClickHandlerProps = {
  onMapClick: (lat: number, lng: number) => void;
};

function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onMapClick]);
  return null;
}

/**
 * Electron / layouts flex a menudo inicializan Leaflet antes de que el contenedor tenga
 * su tamaño final. Eso deja mal calculado el centro/píxeles y las capas vectoriales (paneles,
 * polígono) pueden verse desescaladas respecto a los tiles hasta invalidar tamaño.
 *
 * Importante: no llamar invalidateSize antes de que el mapa esté listo (whenReady) ni después
 * de desmontar el contenedor; en esos casos Leaflet puede recorrer capas con nodos ya rotos y
 * lanzar TypeError (_leaflet_pos undefined). También hay que cancelar todo rAF/timeouts y el
 * debounce del ResizeObserver en cleanup.
 */
function MapLayoutSync() {
  const map = useMap();
  useEffect(() => {
    let disposed = false;
    let roTimer: number | null = null;
    let rafOuter = 0;
    let rafInner = 0;
    let t1 = 0;
    let t2 = 0;

    const safeInvalidate = () => {
      if (disposed) return;
      const el = map.getContainer?.();
      if (!el?.isConnected) return;
      try {
        map.invalidateSize({ animate: false });
      } catch {
        // Inicialización o teardown intermedio; evita fallos en capas/tiles aún no listos.
      }
    };

    const el = map.getContainer();
    const scheduleBurst = () => {
      if (disposed) return;
      safeInvalidate();
      rafOuter = requestAnimationFrame(() => {
        if (disposed) return;
        safeInvalidate();
        rafInner = requestAnimationFrame(() => {
          if (disposed) return;
          safeInvalidate();
        });
      });
      t1 = window.setTimeout(safeInvalidate, 50);
      t2 = window.setTimeout(safeInvalidate, 250);
    };

    map.whenReady(() => {
      if (disposed) return;
      scheduleBurst();
    });

    let observer: ResizeObserver | null = null;
    try {
      observer = new ResizeObserver(() => {
        if (disposed) return;
        if (roTimer != null) window.clearTimeout(roTimer);
        roTimer = window.setTimeout(() => {
          roTimer = null;
          safeInvalidate();
        }, 16);
      });
      observer.observe(el);
    } catch {
      // ResizeObserver no disponible (muy raro)
    }

    const onWinResize = () => safeInvalidate();
    window.addEventListener("resize", onWinResize);
    return () => {
      disposed = true;
      if (roTimer != null) window.clearTimeout(roTimer);
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onWinResize);
      observer?.disconnect();
    };
  }, [map]);
  return null;
}

const ROTATION_HANDLE_OFFSET_LAT = 0.00004;

function angleFromCenterToPoint(
  centerX: number,
  centerY: number,
  pointX: number,
  pointY: number,
): number {
  const dx = pointX - centerX;
  const dy = pointY - centerY;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

type RotationHandleProps = {
  centerLat: number;
  centerLng: number;
  onRotate: (deltaDeg: number) => void;
};

function RotationHandle({ centerLat, centerLng, onRotate }: RotationHandleProps) {
  const map = useMap();
  const [, setTick] = useState(0);
  const initialAngleRef = useRef<number>(0);
  const onRotateRef = useRef(onRotate);
  onRotateRef.current = onRotate;

  useMapEvents({
    moveend: () => setTick((t) => t + 1),
    zoomend: () => setTick((t) => t + 1),
  });

  const container = map.getContainer();
  const handleLat = centerLat + ROTATION_HANDLE_OFFSET_LAT;
  const point = map.latLngToContainerPoint(L.latLng(handleLat, centerLng));

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      map.dragging.disable();
      map.doubleClickZoom?.disable?.();
      const rect = container.getBoundingClientRect();
      const centerPx = map.latLngToContainerPoint(L.latLng(centerLat, centerLng));
      const centerX = rect.left + centerPx.x;
      const centerY = rect.top + centerPx.y;
      initialAngleRef.current = angleFromCenterToPoint(centerX, centerY, e.clientX, e.clientY);

      const onMouseMove = (ev: MouseEvent) => {
        const currentAngle = angleFromCenterToPoint(centerX, centerY, ev.clientX, ev.clientY);
        let delta = currentAngle - initialAngleRef.current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        if (Math.abs(delta) > 0.3) {
          onRotateRef.current(delta);
          initialAngleRef.current = currentAngle;
        }
      };
      const onMouseUp = () => {
        map.dragging.enable();
        map.doubleClickZoom?.enable?.();
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [container, map, centerLat, centerLng],
  );

  return (
    <div
      role="slider"
      aria-label="Manilla de rotación"
      tabIndex={0}
      style={{
        position: "absolute",
        left: point.x,
        top: point.y,
        transform: "translate(-50%, -50%)",
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "rgb(139 92 246)",
        border: "2px solid white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        cursor: "grab",
        zIndex: 1000,
        pointerEvents: "auto",
      }}
      onMouseDown={handleMouseDown}
      className="outline-none focus:ring-2 focus:ring-violet-400"
    />
  );
}

type MoveDragHandlerProps = {
  selectedPlacementIds: number[];
  onMoveSelectionByDelta: (dLat: number, dLng: number) => void;
  startDragRef: React.MutableRefObject<((positionIndex: number, lat: number, lng: number) => void) | null>;
};

function MoveDragHandler({
  selectedPlacementIds,
  onMoveSelectionByDelta,
  startDragRef,
}: MoveDragHandlerProps) {
  const map = useMap();
  const onMoveRef = useRef(onMoveSelectionByDelta);
  onMoveRef.current = onMoveSelectionByDelta;
  const startLatLngRef = useRef<{ lat: number; lng: number }>({ lat: 0, lng: 0 });

  useEffect(() => {
    const selectedSet = new Set(selectedPlacementIds);
    startDragRef.current = (positionIndex: number, lat: number, lng: number) => {
      if (!selectedSet.has(positionIndex)) return;
      map.dragging.disable();
      map.doubleClickZoom?.disable?.();
      startLatLngRef.current = { lat, lng };

      const onMouseMove = (ev: MouseEvent) => {
        const container = map.getContainer();
        const rect = container.getBoundingClientRect();
        const pt = L.point(ev.clientX - rect.left, ev.clientY - rect.top);
        const current = map.containerPointToLatLng(pt);
        const dLat = current.lat - startLatLngRef.current.lat;
        const dLng = current.lng - startLatLngRef.current.lng;
        onMoveRef.current(dLat, dLng);
        startLatLngRef.current = { lat: current.lat, lng: current.lng };
      };
      const onMouseUp = () => {
        map.dragging.enable();
        map.doubleClickZoom?.enable?.();
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };
    return () => {
      startDragRef.current = null;
    };
  }, [map, selectedPlacementIds]);

  return null;
}

export type ImplantationMapProps = {
  centerLat: number;
  centerLng: number;
  zoom: number;
  className?: string;
  roofPolygon?: LatLngTuple[] | null;
  polygonMode?: "draw" | "edit" | null;
  onPolygonComplete?: (points: LatLngTuple[]) => void;
  onPolygonEdit?: (points: LatLngTuple[]) => void;
  onMoveEnd?: (center: { lat: number; lng: number }, zoom: number) => void;
  placements?: PlacementItem[];
  panelLengthMm?: number;
  panelWidthMm?: number;
  panelOrientationMode?: "VERTICAL" | "HORIZONTAL";
  placeMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  selectedPlacementIds?: number[];
  onPanelClick?: (positionIndex: number) => void;
  onPanelDoubleClick?: (positionIndex: number) => void;
  onPanelRightClick?: (positionIndex: number) => void;
  rotationHandleCenter?: { lat: number; lng: number } | null;
  onRotateSelection?: (deltaDeg: number) => void;
  activeTool?: string;
  onMoveSelectionByDelta?: (dLat: number, dLng: number) => void;
  mapContainerRef?: React.RefObject<HTMLDivElement | null>;
  locationPin?: { lat: number; lng: number } | null;
  onLocationPinMove?: (lat: number, lng: number) => void;
  /** Si true, superpone una capa de etiquetas (nombres de calles, lugares) sobre la imagen satelital. Por defecto true. */
  showStreetLabels?: boolean;
};

export function ImplantationMap({
  centerLat,
  centerLng,
  zoom,
  className = "",
  roofPolygon = null,
  polygonMode = null,
  onPolygonComplete,
  onPolygonEdit,
  onMoveEnd,
  placements = [],
  panelLengthMm = 0,
  panelWidthMm = 0,
  panelOrientationMode = "HORIZONTAL",
  placeMode: _placeMode = false,
  onMapClick,
  selectedPlacementIds = [],
  onPanelClick,
  onPanelDoubleClick,
  onPanelRightClick,
  rotationHandleCenter = null,
  onRotateSelection,
  activeTool: _activeTool,
  onMoveSelectionByDelta,
  mapContainerRef,
  locationPin = null,
  onLocationPinMove,
  showStreetLabels = true,
}: ImplantationMapProps) {
  const moveDragStartRef = useRef<((positionIndex: number, lat: number, lng: number) => void) | null>(null);
  const center: [number, number] = useMemo(
    () => [Number(centerLat), Number(centerLng)],
    [centerLat, centerLng],
  );
  const zoomLevel = useMemo(() => Math.min(22, Math.max(1, Math.round(zoom))), [zoom]);

  return (
    <div ref={mapContainerRef as React.RefObject<HTMLDivElement>} className={className} style={{ minHeight: 280, height: "100%" }}>
      <MapContainer
        center={center}
        zoom={zoomLevel}
        minZoom={2}
        maxZoom={22}
        scrollWheelZoom
        style={{ height: "100%", minHeight: 280 }}
        className="h-full w-full rounded-lg"
      >
        <MapLayoutSync />
        <TileLayer
          attribution={ESRI_ATTRIBUTION}
          url={ESRI_SAT_URL}
          maxNativeZoom={19}
          maxZoom={22}
        />
        {showStreetLabels && (
          <TileLayer
            attribution={CARTO_LABELS_ATTRIBUTION}
            url={CARTO_LABELS_URL}
            subdomains="abcd"
            maxZoom={22}
            maxNativeZoom={20}
            minZoom={1}
            zIndex={500}
          />
        )}
        <MapUpdater center={center} zoom={zoomLevel} />
        {onMoveEnd && <MapMoveReporter onMoveEnd={onMoveEnd} />}
        {onPolygonComplete && onPolygonEdit && (polygonMode !== null || (roofPolygon && roofPolygon.length >= 3)) && (
          <RoofPolygonDrawEdit
            roofPolygon={roofPolygon ?? null}
            mode={polygonMode ?? null}
            onPolygonComplete={onPolygonComplete}
            onPolygonEdit={onPolygonEdit}
          />
        )}
        {placements.length > 0 && panelLengthMm > 0 && panelWidthMm > 0 && (
          <PanelPlacementsLayer
            placements={placements}
            panelLengthMm={panelLengthMm}
            panelWidthMm={panelWidthMm}
            panelOrientationMode={panelOrientationMode}
            selectedPlacementIds={selectedPlacementIds}
            onPanelClick={onPanelClick}
            onPanelDoubleClick={onPanelDoubleClick}
            onPanelRightClick={onPanelRightClick}
            onPanelMouseDown={
              selectedPlacementIds.length > 0 && onMoveSelectionByDelta
                ? (positionIndex, lat, lng) => {
                    moveDragStartRef.current?.(positionIndex, lat, lng);
                  }
                : undefined
            }
          />
        )}
        {selectedPlacementIds.length > 0 && onMoveSelectionByDelta && (
          <MoveDragHandler
            selectedPlacementIds={selectedPlacementIds}
            onMoveSelectionByDelta={onMoveSelectionByDelta}
            startDragRef={moveDragStartRef}
          />
        )}
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
        {locationPin && onLocationPinMove && (
          <Marker
            position={[locationPin.lat, locationPin.lng]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = e.target.getLatLng();
                onLocationPinMove(ll.lat, ll.lng);
              },
            }}
          />
        )}
        {rotationHandleCenter && onRotateSelection && (
          <RotationHandle
            centerLat={rotationHandleCenter.lat}
            centerLng={rotationHandleCenter.lng}
            onRotate={onRotateSelection}
          />
        )}
      </MapContainer>
    </div>
  );
}

export { DEFAULT_CENTER, DEFAULT_ZOOM };
