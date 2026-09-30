import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

/** Convierte dirección + comuna en coordenadas. Sin estado ni sesión. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { address?: unknown; commune?: unknown } | null;
  const address = typeof body?.address === "string" ? body.address.trim().slice(0, 200) : "";
  const commune = typeof body?.commune === "string" ? body.commune.trim().slice(0, 100) : "";
  if (!address || !commune) return NextResponse.json({ error: "Faltan la dirección y la comuna." }, { status: 400 });
  try {
    const result = await geocodeAddress(address, commune);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "No encontramos esa dirección." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "El servicio de mapas no respondió." }, { status: 502 });
  }
}
