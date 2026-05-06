/**
 * Métricas del layout de implantación: área de techo, área de paneles, orientaciones.
 * Cálculo de área del polígono en m² usando proyección local en el centroide.
 */

export type LatLngTuple = [number, number];

const METERS_PER_DEGREE_LAT = 111320;
const DEG2RAD = Math.PI / 180;

/**
 * Calcula el área del polígono (techo/paño) en m².
 * Usa proyección local tangente en el centroide para convertir lat/lng a metros
 * y luego fórmula del shoelace para el área plana.
 */
export function polygonAreaM2(points: LatLngTuple[]): number {
  if (points.length < 3) return 0;
  const n = points.length;
  let sumLat = 0;
  let sumLng = 0;
  for (let i = 0; i < n; i++) {
    sumLat += points[i][0];
    sumLng += points[i][1];
  }
  const centerLat = sumLat / n;
  const centerLng = sumLng / n;
  const cosLat = Math.cos(centerLat * DEG2RAD);
  const mPerDegLng = METERS_PER_DEGREE_LAT * cosLat;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const [lat, lng] = points[i];
    ys.push((lat - centerLat) * METERS_PER_DEGREE_LAT);
    xs.push((lng - centerLng) * mPerDegLng);
  }

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += xs[i] * ys[j] - xs[j] * ys[i];
  }
  return Math.abs(area) / 2;
}

/**
 * Área total de paneles en m²: cantidad × área unitaria (lengthMm × widthMm en m²).
 */
export function panelAreaTotalM2(
  count: number,
  lengthMm: number,
  widthMm: number,
): number {
  if (count <= 0 || lengthMm <= 0 || widthMm <= 0) return 0;
  const areaOneM2 = (lengthMm / 1000) * (widthMm / 1000);
  return count * areaOneM2;
}

/**
 * Porcentaje de ocupación: área paneles / área techo × 100.
 */
export function occupancyPercent(panelAreaM2: number, roofAreaM2: number): number {
  if (roofAreaM2 <= 0) return 0;
  return Math.min(100, (panelAreaM2 / roofAreaM2) * 100);
}

/**
 * Caja axial del polígono en metros (proyección local en el centroide), para comparar orden de magnitud
 * con el rectángulo del panel en planta (no es el ancho real del techo si está rotado).
 */
export function roofBoundingBoxSpanMeters(points: LatLngTuple[]): { widthM: number; heightM: number } {
  if (points.length < 3) return { widthM: 0, heightM: 0 };
  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [lat, lng] = points[i];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos(midLat * DEG2RAD);
  const mPerDegLng = METERS_PER_DEGREE_LAT * cosLat;
  const heightM = (maxLat - minLat) * METERS_PER_DEGREE_LAT;
  const widthM = (maxLng - minLng) * mPerDegLng;
  return { widthM, heightM };
}
