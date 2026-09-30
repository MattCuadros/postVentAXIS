import { NextResponse } from "next/server";
import { resolveMapsLink } from "@/lib/maps-link";

/** Sigue un enlace de Google Maps (corto o largo) y devuelve sus coordenadas. Sin estado ni sesión. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  if (typeof body?.url !== "string") return NextResponse.json({ error: "Falta el enlace." }, { status: 400 });
  try {
    const point = await resolveMapsLink(body.url);
    return point ? NextResponse.json(point) : NextResponse.json({ error: "No encontramos coordenadas en ese enlace." }, { status: 422 });
  } catch {
    return NextResponse.json({ error: "No pudimos abrir el enlace." }, { status: 502 });
  }
}
