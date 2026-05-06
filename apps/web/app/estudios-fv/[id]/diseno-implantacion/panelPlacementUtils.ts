import { normalizeLikelyMetersToMm } from "./panelDimensionsMm";

/**
 * Convierte un placement (origen + dimensiones + orientación) en los 4 vértices del rectángulo
 * para dibujar el panel a escala en el mapa.
 * Origen = esquina inferior izquierda.
 * HORIZONTAL: largo en E-O (lng), ancho en N-S (lat).
 * VERTICAL: largo en N-S (lat), ancho en E-O (lng).
 * orientationDeg = rotación en planta (grados, 0 = este, 90 = norte).
 */

export type LatLngTuple = [number, number];

const METERS_PER_DEGREE_LAT = 111320;
const DEG2RAD = Math.PI / 180;

export function rotatePointAroundCenter(
  centerLat: number,
  centerLng: number,
  lat: number,
  lng: number,
  angleDeg: number,
): LatLngTuple {
  if (angleDeg === 0) return [lat, lng];
  const latRad = centerLat * DEG2RAD;
  const cosLat = Math.cos(latRad);
  const northM = (lat - centerLat) * METERS_PER_DEGREE_LAT;
  const eastM = (lng - centerLng) * METERS_PER_DEGREE_LAT * cosLat;
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const newEastM = eastM * c - northM * s;
  const newNorthM = eastM * s + northM * c;
  return [
    centerLat + newNorthM / METERS_PER_DEGREE_LAT,
    centerLng + newEastM / (METERS_PER_DEGREE_LAT * cosLat),
  ];
}

function rotatePointAroundOrigin(
  originLat: number,
  originLng: number,
  lat: number,
  lng: number,
  angleDeg: number,
): LatLngTuple {
  return rotatePointAroundCenter(originLat, originLng, lat, lng, angleDeg);
}

export function placementToPolygonLatLngs(
  originLat: number,
  originLng: number,
  lengthMm: number,
  widthMm: number,
  orientationMode: "VERTICAL" | "HORIZONTAL",
  orientationDeg = 0,
): LatLngTuple[] {
  const norm = normalizeLikelyMetersToMm(lengthMm, widthMm);
  const lm = norm.lengthMm;
  const wm = norm.widthMm;
  if (lm <= 0 || wm <= 0) return [];
  const lengthM = lm / 1000;
  const widthM = wm / 1000;
  const latRad = originLat * DEG2RAD;
  const dLngPerM = 1 / (METERS_PER_DEGREE_LAT * Math.cos(latRad));
  const dLatPerM = 1 / METERS_PER_DEGREE_LAT;
  const dLatW = widthM * dLatPerM;
  const dLngW = widthM * dLngPerM;
  const dLatL = lengthM * dLatPerM;
  const dLngL = lengthM * dLngPerM;

  let corners: LatLngTuple[];
  if (orientationMode === "HORIZONTAL") {
    corners = [
      [originLat, originLng],
      [originLat, originLng + dLngL],
      [originLat + dLatW, originLng + dLngL],
      [originLat + dLatW, originLng],
    ];
  } else {
    corners = [
      [originLat, originLng],
      [originLat + dLatL, originLng],
      [originLat + dLatL, originLng + dLngW],
      [originLat, originLng + dLngW],
    ];
  }
  if (orientationDeg !== 0) {
    corners = corners.map(([lat, lng]) =>
      rotatePointAroundOrigin(originLat, originLng, lat, lng, orientationDeg),
    );
  }
  return corners;
}

export type BlockPlacementItem = {
  originLat: number;
  originLng: number;
  orientationDeg: number;
  orientationMode: "VERTICAL" | "HORIZONTAL";
};

/**
 * Genera los orígenes de un bloque de paneles en rejilla rotada.
 * baseLat/baseLng = esquina inferior izquierda del primer panel.
 * angleDeg = rotación en planta del bloque (0 = fila hacia este).
 * countX = paneles en la dirección X (a lo largo de la fila).
 * countY = paneles en la dirección Y (filas).
 *
 * Separación borde a borde: paso = dimensión_del_panel_en_esa_dirección + separación_mm.
 * Todo en metros: (dimMm/1000 + spacingMm/1000).
 */
export function computeBlockPlacements(
  baseLat: number,
  baseLng: number,
  angleDeg: number,
  countX: number,
  countY: number,
  lengthMm: number,
  widthMm: number,
  spacingHorizontalMm: number,
  spacingVerticalMm: number,
  orientationMode: "VERTICAL" | "HORIZONTAL",
): BlockPlacementItem[] {
  const norm = normalizeLikelyMetersToMm(lengthMm, widthMm);
  const lm = norm.lengthMm;
  const wm = norm.widthMm;
  if (countX < 1 || countY < 1 || lm <= 0 || wm <= 0) return [];
  const lengthM = lm / 1000;
  const widthM = wm / 1000;
  const spacingHM = spacingHorizontalMm / 1000;
  const spacingVM = spacingVerticalMm / 1000;

  // Paso = dimensión del panel en esa dirección + separación (borde a borde).
  // HORIZONTAL: fila va en dirección "length" (lng), siguiente fila en "width" (lat).
  // VERTICAL: fila va en dirección "width" (lng), siguiente fila en "length" (lat).
  const stepXM: number =
    orientationMode === "HORIZONTAL"
      ? lengthM + spacingHM
      : widthM + spacingHM;
  const stepYM: number =
    orientationMode === "HORIZONTAL"
      ? widthM + spacingVM
      : lengthM + spacingVM;

  const latRad = baseLat * DEG2RAD;
  const cosLat = Math.cos(latRad);
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dxEast = stepXM * c;
  const dxNorth = stepXM * s;
  const dyEast = stepYM * (-s);
  const dyNorth = stepYM * c;
  const lngPerM = 1 / (METERS_PER_DEGREE_LAT * cosLat);
  const latPerM = 1 / METERS_PER_DEGREE_LAT;
  const out: BlockPlacementItem[] = [];
  for (let j = 0; j < countY; j++) {
    for (let i = 0; i < countX; i++) {
      const eastM = i * dxEast + j * dyEast;
      const northM = i * dxNorth + j * dyNorth;
      out.push({
        originLat: baseLat + northM * latPerM,
        originLng: baseLng + eastM * lngPerM,
        orientationDeg: angleDeg,
        orientationMode,
      });
    }
  }
  return out;
}
