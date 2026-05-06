/**
 * Conversión entre polígono en estado (array [lat, lng]) y GeoJSON Polygon (coordinates en [lng, lat]).
 */

export type LatLngTuple = [number, number];

/**
 * GeoJSON Polygon: coordinates[0] = exterior ring, each ring is [lng, lat][].
 */
export function polygonToGeoJson(points: LatLngTuple[]): string {
  if (points.length < 3) return "";
  const ring = points.map(([lat, lng]) => [lng, lat]);
  ring.push(ring[0]);
  return JSON.stringify({ type: "Polygon", coordinates: [ring] });
}

/**
 * Parsea roofPolygonGeoJson y devuelve array de [lat, lng] del anillo exterior (sin repetir el cierre).
 */
export function geoJsonToPolygon(geoJson: string | null | undefined): LatLngTuple[] | null {
  if (!geoJson || typeof geoJson !== "string") return null;
  try {
    const parsed = JSON.parse(geoJson) as { type?: string; coordinates?: number[][][] };
    if (parsed.type !== "Polygon" || !Array.isArray(parsed.coordinates?.[0])) return null;
    const ring = parsed.coordinates[0];
    const points: LatLngTuple[] = [];
    for (let i = 0; i < ring.length; i++) {
      const [lng, lat] = ring[i];
      if (typeof lng === "number" && typeof lat === "number") points.push([lat, lng]);
    }
    if (points.length >= 3 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]) {
      points.pop();
    }
    return points.length >= 3 ? points : null;
  } catch {
    return null;
  }
}
