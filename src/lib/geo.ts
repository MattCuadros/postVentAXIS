import type { GeoPoint } from "@/types/domain";

/** Enlaces de lugar: ...!3d-33.44!4d-70.66 (el punto exacto del lugar). */
const PLACE_DATA = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const PAIR = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/;

/**
 * Lee coordenadas desde lo que el admin pega: "-33.4489, -70.6693" (lo que copia Google Maps
 * con clic derecho) o un enlace de Google Maps (`!3dlat!4dlng`, `@lat,lng,…`, `?q=lat,lng`,
 * `query=lat,lng`). En un enlace de lugar manda `!3d!4d` (el punto exacto) sobre `@` (el centro
 * del mapa, que puede estar corrido).
 */
export function parseCoordinates(text: string): GeoPoint | null {
  const input = text.trim();
  if (!input) return null;

  const fromUrl =
    PLACE_DATA.exec(input) ??
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(input) ??
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(safeDecode(input));
  const match = fromUrl ?? PAIR.exec(input);
  if (match === null) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Enlaces cortos de Google Maps: hay que seguirlos en el servidor para leer sus coordenadas. */
export function looksLikeMapsShortLink(text: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\b/i.test(text.trim());
}

export function formatCoordinates(point: GeoPoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

export function mapsUrl(point: GeoPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}
