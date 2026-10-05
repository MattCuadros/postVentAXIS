import { NextResponse } from "next/server";
import { buildZoneStatsPdf } from "@/lib/zone-stats-pdf";
import { reportPdfContextSchema } from "@/lib/zone-stats-pdf-schema";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Filtros inválidos" }, { status: 400 }); }
  const parsed = reportPdfContextSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Informe inválido" }, { status: 400 });
  const context = parsed.data;
  const report = await buildZoneStatsPdf(context);
  return new Response(Uint8Array.from(report.bytes).buffer, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${report.filename}"`, "cache-control": "no-store" } });
}
