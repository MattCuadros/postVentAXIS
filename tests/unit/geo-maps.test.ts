import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as geocodeRoute } from "@/app/api/geocode/route";
import { POST as resolveRoute } from "@/app/api/resolve-maps-link/route";
import { looksLikeMapsShortLink, parseCoordinates } from "@/lib/geo";
import { isAllowedMapsUrl, resolveMapsLink } from "@/lib/maps-link";

afterEach(() => vi.unstubAllGlobals());

describe("parseCoordinates", () => {
  it("par suelto", () => expect(parseCoordinates("-33.4489, -70.6693")).toEqual({ lat: -33.4489, lng: -70.6693 }));

  it("enlace con @", () =>
    expect(parseCoordinates("https://www.google.com/maps/@-33.4489,-70.6693,17z")).toEqual({ lat: -33.4489, lng: -70.6693 }));

  it("enlace de lugar con !3d!4d (manda sobre @)", () =>
    expect(parseCoordinates("https://www.google.com/maps/place/X/@-33.40,-70.60,17z/data=!3m1!4b1!4m6!3d-33.4489!4d-70.6693")).toEqual({
      lat: -33.4489,
      lng: -70.6693,
    }));

  it("q= y query=", () => {
    expect(parseCoordinates("https://maps.google.com/?q=-33.5,-70.5")).toEqual({ lat: -33.5, lng: -70.5 });
    expect(parseCoordinates("https://www.google.com/maps/search/?api=1&query=-33.5,-70.5")).toEqual({ lat: -33.5, lng: -70.5 });
  });

  it("texto sin coordenadas o fuera de rango: null", () => {
    expect(parseCoordinates("Av. Providencia 1234")).toBeNull();
    expect(parseCoordinates("120.5, -70.6")).toBeNull();
    expect(parseCoordinates("-33.4, 200.1")).toBeNull();
    expect(parseCoordinates("")).toBeNull();
  });

  it("no revienta con % mal formado", () => expect(parseCoordinates("https://x.cl/?q=100%")).toBeNull());

  it("reconoce enlaces cortos", () => {
    expect(looksLikeMapsShortLink("https://maps.app.goo.gl/AbCdEf")).toBe(true);
    expect(looksLikeMapsShortLink("https://www.google.com/maps/@-33,-70,1z")).toBe(false);
  });
});

describe("isAllowedMapsUrl (anti proxy abierto)", () => {
  it("acepta solo https y hosts de la lista blanca", () => {
    for (const ok of ["https://maps.app.goo.gl/x", "https://goo.gl/maps/x", "https://www.google.com/maps", "https://google.com/maps", "https://maps.google.com/?q=1,2"]) {
      expect(isAllowedMapsUrl(ok), ok).not.toBeNull();
    }
  });

  it("rechaza http, otros hosts, credenciales, puertos y engaños de subdominio", () => {
    for (const bad of [
      "http://maps.app.goo.gl/x",
      "https://evil.com/",
      "https://maps.google.com.evil.com/",
      "https://google.com@evil.com/",
      "https://user:pass@www.google.com/",
      "https://www.google.com:8443/",
      "https://169.254.169.254/latest/meta-data",
      "http://localhost:3000/",
      "file:///etc/passwd",
      "no es una url",
    ]) {
      expect(isAllowedMapsUrl(bad), bad).toBeNull();
    }
  });
});

describe("resolveMapsLink", () => {
  it("sigue redirecciones permitidas hasta encontrar coordenadas", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://www.google.com/maps/place/X/@-33.4,-70.6,17z/data=!3d-33.4489!4d-70.6693" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveMapsLink("https://maps.app.goo.gl/AbCdEf")).toEqual({ lat: -33.4489, lng: -70.6693 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no sigue una redirección a otro host", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://evil.com/steal" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveMapsLink("https://maps.app.goo.gl/AbCdEf")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("corta un bucle de redirecciones", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 302, headers: { location: "https://goo.gl/maps/otra" } })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveMapsLink("https://goo.gl/maps/una")).toBeNull();
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("nunca hace fetch a un host no permitido", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await resolveMapsLink("https://evil.com/")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function post(body: unknown): Request {
  return new Request("http://localhost/api/x", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

describe("POST /api/resolve-maps-link", () => {
  it("400 sin url, 422 con un host no permitido, 200 con coordenadas en el propio enlace", async () => {
    expect((await resolveRoute(post({}))).status).toBe(400);
    expect((await resolveRoute(post({ url: "https://evil.com/" }))).status).toBe(422);
    const ok = await resolveRoute(post({ url: "https://www.google.com/maps/@-33.4489,-70.6693,17z" }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ lat: -33.4489, lng: -70.6693 });
  });
});

describe("POST /api/geocode", () => {
  it("400 si faltan dirección o comuna", async () => {
    expect((await geocodeRoute(post({ address: "Av. Ejemplo 1234" }))).status).toBe(400);
  });

  it("consulta Nominatim con los parámetros pedidos y devuelve coordenadas y nombre", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ lat: "-33.45", lon: "-70.66", display_name: "Av. Ejemplo 1234, Santiago, Chile" }])));
    vi.stubGlobal("fetch", fetchMock);
    const response = await geocodeRoute(post({ address: "Av. Ejemplo 1234", commune: "Santiago" }));
    expect(await response.json()).toEqual({ lat: -33.45, lng: -70.66, label: "Av. Ejemplo 1234, Santiago, Chile" });
    const [url, init] = fetchMock.mock.calls[0];
    const params = new URL(String(url)).searchParams;
    expect(params.get("countrycodes")).toBe("cl");
    expect(params.get("limit")).toBe("1");
    expect(params.get("accept-language")).toBe("es");
    expect(params.get("q")).toBe("Av. Ejemplo 1234, Santiago, Chile");
    expect((init as RequestInit).headers).toHaveProperty("User-Agent");
  });

  it("404 si no hay resultado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]")));
    expect((await geocodeRoute(post({ address: "Calle inexistente 0", commune: "Nunca" }))).status).toBe(404);
  });
});
