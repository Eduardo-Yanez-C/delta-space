"use client";

import L from "leaflet";
import { Polygon } from "react-leaflet";
import { placementToPolygonLatLngs } from "./panelPlacementUtils";

export type PlacementItem = {
  positionIndex: number;
  originLat: number;
  originLng: number;
  orientationDeg?: number;
  /** Por bloque/colocación; si falta, usa `panelOrientationMode` del layer. */
  orientationMode?: "VERTICAL" | "HORIZONTAL";
  blockId?: string;
};

type PanelPlacementsLayerProps = {
  placements: PlacementItem[];
  panelLengthMm: number;
  panelWidthMm: number;
  panelOrientationMode: "VERTICAL" | "HORIZONTAL";
  selectedPlacementIds?: number[];
  onPanelClick?: (positionIndex: number) => void;
  onPanelDoubleClick?: (positionIndex: number) => void;
  onPanelRightClick?: (positionIndex: number) => void;
  onPanelMouseDown?: (positionIndex: number, lat: number, lng: number) => void;
};

const PANEL_STYLE: L.PathOptions = {
  color: "#15803d",
  weight: 2,
  fillColor: "#22c55e",
  fillOpacity: 0.35,
};

const SELECTED_STYLE: L.PathOptions = {
  color: "#b45309",
  weight: 3,
  fillColor: "#f59e0b",
  fillOpacity: 0.5,
};

export function PanelPlacementsLayer({
  placements,
  panelLengthMm,
  panelWidthMm,
  panelOrientationMode,
  selectedPlacementIds = [],
  onPanelClick,
  onPanelDoubleClick,
  onPanelRightClick,
  onPanelMouseDown,
}: PanelPlacementsLayerProps) {
  if (panelLengthMm <= 0 || panelWidthMm <= 0) return null;
  const selectedSet = new Set(selectedPlacementIds);

  return (
    <>
      {placements.map((p) => {
        const positions = placementToPolygonLatLngs(
          p.originLat,
          p.originLng,
          panelLengthMm,
          panelWidthMm,
          p.orientationMode ?? panelOrientationMode,
          p.orientationDeg ?? 0,
        );
        if (positions.length < 3) return null;
        const isSelected = selectedSet.has(p.positionIndex);
        const pathOptions = isSelected ? SELECTED_STYLE : PANEL_STYLE;
        const eventHandlers: L.LeafletEventHandlerFnMap = {};
        if (onPanelClick) {
          eventHandlers.click = (e) => {
            L.DomEvent.stopPropagation(e.originalEvent);
            e.originalEvent.preventDefault();
            e.originalEvent.stopImmediatePropagation?.();
            onPanelClick(p.positionIndex);
          };
        }
        if (onPanelDoubleClick) {
          eventHandlers.dblclick = (e) => {
            L.DomEvent.stopPropagation(e.originalEvent);
            e.originalEvent.preventDefault();
            e.originalEvent.stopImmediatePropagation?.();
            onPanelDoubleClick(p.positionIndex);
          };
        }
        if (onPanelRightClick) {
          eventHandlers.contextmenu = (e) => {
            L.DomEvent.stopPropagation(e.originalEvent);
            e.originalEvent.preventDefault();
            onPanelRightClick(p.positionIndex);
          };
        }
        if (onPanelMouseDown) {
          eventHandlers.mousedown = (e) => {
            L.DomEvent.stopPropagation(e.originalEvent);
            e.originalEvent.preventDefault();
            e.originalEvent.stopImmediatePropagation?.();
            onPanelMouseDown(p.positionIndex, e.latlng.lat, e.latlng.lng);
          };
        }
        return (
          <Polygon
            key={`${p.positionIndex}-${p.originLat}-${p.originLng}`}
            positions={positions}
            pathOptions={pathOptions}
            eventHandlers={Object.keys(eventHandlers).length > 0 ? eventHandlers : undefined}
          />
        );
      })}
    </>
  );
}
