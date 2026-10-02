/**
 * Dirección → coordenadas. Solo corre en el servidor. Hoy usa Nominatim (OpenStreetMap); para
 * cambiar a Google basta con reemplazar el cuerpo de `geocodeAddress` (el resto del sistema solo
 * conoce esta función).
 *
 * Política de uso de Nominatim: máximo 1 solicitud por segundo, User-Agent identificable y sin
 * autocompletado; por eso se espacian las llamadas aquí y el formulario solo busca al pedirlo.
 * (El espaciado es por instancia del servidor: suficiente para el uso de un solo admin a la vez.)
 */
import type { GeoPoint } from "@/types/domain";

export interface GeocodeResult extends GeoPoint {
  /** Nombre normalizado que devuelve el servicio, para que la persona confirme el lugar. */
  label: string;
}

const MIN_INTERVAL_MS = 1100;
let nextSlot = 0;

async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + MIN_INTERVAL_MS;
  if (start > now) await new Promise((resolve) => setTimeout(resolve, start - now));
}

export async function geocodeAddress(address: string, commune: string): Promise<GeocodeResult | null> {
  await waitForSlot();
  const params = new URLSearchParams({
    q: `${address}, ${commune}, Chile`,
    format: "jsonv2",
    countrycodes: "cl",
    limit: "1",
    "accept-language": "es",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "PostventAXIS/1.0 (postventa Axis Desarrollos Constructivos)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const [first] = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, label: first.display_name } : null;
}
