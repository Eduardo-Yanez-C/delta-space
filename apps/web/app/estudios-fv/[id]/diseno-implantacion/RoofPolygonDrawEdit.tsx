"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import type { LatLngTuple } from "./roofPolygonUtils";

type RoofPolygonDrawEditProps = {
  roofPolygon: LatLngTuple[] | null;
  mode: "draw" | "edit" | null;
  onPolygonComplete: (points: LatLngTuple[]) => void;
  onPolygonEdit: (points: LatLngTuple[]) => void;
};

function latLngsToTuples(latlngs: L.LatLng[]): LatLngTuple[] {
  return latlngs.map((ll) => [ll.lat, ll.lng]);
}

const LDraw = (L as unknown as { Control?: { Draw: new (o: unknown) => L.Control } }).Control?.Draw;

export function RoofPolygonDrawEdit({
  roofPolygon,
  mode,
  onPolygonComplete,
  onPolygonEdit,
}: RoofPolygonDrawEditProps) {
  const map = useMap();
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control | null>(null);
  const onPolygonCompleteRef = useRef(onPolygonComplete);
  const onPolygonEditRef = useRef(onPolygonEdit);
  onPolygonCompleteRef.current = onPolygonComplete;
  onPolygonEditRef.current = onPolygonEdit;

  useEffect(() => {
    if (!featureGroupRef.current) {
      const fg = new L.FeatureGroup();
      featureGroupRef.current = fg;
      map.addLayer(fg);
    }
    const fg = featureGroupRef.current;
    fg.clearLayers();
    if (roofPolygon && roofPolygon.length >= 3) {
      const polygon = L.polygon(roofPolygon, {
        color: "#0ea5e9",
        weight: 2,
        fillColor: "#0ea5e9",
        fillOpacity: 0.25,
      });
      fg.addLayer(polygon);
    }
  }, [map, roofPolygon]);

  useEffect(() => {
    const existingControl = drawControlRef.current;
    if (existingControl) {
      const drawControl = existingControl as L.Control & { _toolbar?: { disable: () => void } };
      try {
        drawControl._toolbar?.disable();
      } catch (_) {}
      try {
        map.removeControl(existingControl);
      } catch (_) {}
      drawControlRef.current = null;
    }

    const fg = featureGroupRef.current;
    if (!fg) return;

    if (mode === "draw" && LDraw) {
      const drawControl = new LDraw({
        draw: {
          polygon: {
            allowIntersection: false,
            shapeOptions: { color: "#0ea5e9", fillOpacity: 0.25 },
            metric: true,
          },
          polyline: false,
          circle: false,
          rectangle: false,
          marker: false,
          circlemarker: false,
        },
        edit: false,
      });
      map.addControl(drawControl);
      drawControlRef.current = drawControl;

      const onCreated = (e: L.LeafletEvent) => {
        const event = e as unknown as { layer: L.Polygon };
        const layer = event.layer;
        const latlngs = layer.getLatLngs()[0] as L.LatLng[];
        if (latlngs && latlngs.length >= 3) {
          onPolygonCompleteRef.current(latLngsToTuples(latlngs));
        }
        map.removeLayer(layer);
      };
      map.on("draw:created", onCreated);
      return () => {
        map.off("draw:created", onCreated);
        const ctrl = drawControlRef.current;
        if (ctrl) {
          try {
            (ctrl as L.Control & { _toolbar?: { disable: () => void } })._toolbar?.disable();
          } catch (_) {}
          try {
            map.removeControl(ctrl);
          } catch (_) {}
          drawControlRef.current = null;
        }
      };
    }

    if (mode === "edit" && roofPolygon && roofPolygon.length >= 3 && LDraw) {
      const editControl = new LDraw({
        draw: false,
        edit: {
          featureGroup: fg,
          edit: true,
          remove: false,
        },
      });
      map.addControl(editControl);
      drawControlRef.current = editControl;

      const onEdited = () => {
        const layers = fg.getLayers();
        const layer = layers[0] as L.Polygon | undefined;
        if (layer && typeof layer.getLatLngs === "function") {
          const latlngs = layer.getLatLngs()[0] as L.LatLng[];
          if (latlngs && latlngs.length >= 3) {
            onPolygonEditRef.current(latLngsToTuples(latlngs));
          }
        }
      };
      map.on("draw:edited", onEdited);
      return () => {
        map.off("draw:edited", onEdited);
        const ctrl = drawControlRef.current;
        if (ctrl) {
          try {
            (ctrl as L.Control & { _toolbar?: { disable: () => void } })._toolbar?.disable();
          } catch (_) {}
          try {
            map.removeControl(ctrl);
          } catch (_) {}
          drawControlRef.current = null;
        }
      };
    }

    return undefined;
  }, [map, mode, roofPolygon]);

  useEffect(() => {
    return () => {
      if (featureGroupRef.current) {
        try {
          map.removeLayer(featureGroupRef.current);
        } catch (_) {}
        featureGroupRef.current = null;
      }
      const ctrl = drawControlRef.current;
      if (ctrl) {
        try {
          (ctrl as L.Control & { _toolbar?: { disable: () => void } })._toolbar?.disable();
        } catch (_) {}
        try {
          map.removeControl(ctrl);
        } catch (_) {}
        drawControlRef.current = null;
      }
    };
  }, [map]);

  return null;
}
