/**
 * Resuelve enlaces de Google Maps (incluidos los cortos de "Compartir") a coordenadas. Solo corre
 * en el servidor. Es un proxy con lista blanca: nunca sigue una URL fuera de estos hosts, para que
 * no sirva como proxy abierto (SSRF).
 */
import { parseCoordinates } from "@/lib/geo";
import type { GeoPoint } from "@/types/domain";

export const ALLOWED_MAPS_HOSTS = ["maps.app.goo.gl", "goo.gl", "www.google.com", "google.com", "maps.google.com"];
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 5000;

/** https, sin credenciales ni puerto raro, y host de la lista blanca. */
export function isAllowedMapsUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
  return ALLOWED_MAPS_HOSTS.includes(url.hostname.toLowerCase()) ? url : null;
}

export async function resolveMapsLink(input: string): Promise<GeoPoint | null> {
  let current = isAllowedMapsUrl(input.trim());
  if (!current) return null;

  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const direct = parseCoordinates(current.toString());
    if (direct) return direct;

    const response = await fetch(current, { redirect: "manual", signal: deadline, headers: { "User-Agent": "PostventAXIS/1.0" } });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      const next = isAllowedMapsUrl(new URL(location, current).toString());
      if (!next) return null;
      current = next;
      continue;
    }
    // Sin más redirecciones: última oportunidad, leer el punto exacto o el centro dentro de la página.
    const html = response.ok ? (await response.text()).slice(0, 500_000) : "";
    const found = html.match(/!3d-?\d+(?:\.\d+)?!4d-?\d+(?:\.\d+)?/)?.[0] ?? html.match(/@-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/)?.[0];
    return found ? parseCoordinates(found) : null;
  }
  return null;
}
