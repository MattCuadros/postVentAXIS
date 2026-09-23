import type { GeoPoint } from "@/types/domain";

const PAIR = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/;

/**
 * Lee coordenadas desde lo que el admin pega: "-33.4489, -70.6693" (lo que copia Google Maps
 * con clic derecho) o un enlace de Google Maps (`@lat,lng,…`, `?q=lat,lng`, `query=lat,lng`).
 */
export function parseCoordinates(text: string): GeoPoint | null {
  const input = text.trim();
  if (!input) return null;

  const fromUrl = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(input) ?? /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(decodeURIComponent(input));
  const match = fromUrl ?? PAIR.exec(input);
  if (match === null) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function formatCoordinates(point: GeoPoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

export function mapsUrl(point: GeoPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}
