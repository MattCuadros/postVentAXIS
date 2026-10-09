import { describe, expect, it } from "vitest";
import { reportPdfContextSchema } from "@/lib/zone-stats-pdf-schema";
import { zoneStatsSummary } from "@/lib/export-zone-stats";
import { computeZoneStats, DEFAULT_FILTERS } from "@/lib/zone-stats";
import { categories, crews, projects, tickets, units, zones, users, statusHistory } from "@/mocks/data";
import { POST } from "@/app/api/reports/pdf/route";

describe("informe PDF de estadísticas", () => {
  it("produce un PDF válido sin datos personales de propietarios", async () => {
    const stats = computeZoneStats({ ...DEFAULT_FILTERS, period: "TODO" }, { tickets, history: statusHistory, units, projects, categories, crews }, new Date("2026-10-05T12:00:00Z"));
    const payload = reportPdfContextSchema.parse({ encargado: users[1].name, filters: { ...DEFAULT_FILTERS, period: "TODO" }, filterNames: { zone: zones[0].name, project: "Todas", category: "Todos", crew: "Todos" }, stats: { ...stats, start: stats.start?.toISOString() ?? null, end: stats.end.toISOString(), rows: stats.rows.map((item) => ({ folio: item.ticket.folio, unit: item.unit?.number ?? "Sin unidad", days: item.days, status: item.ticket.status })) } });
    const response = await POST(new Request("http://localhost/api/reports/pdf", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }));
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    const pdfText = new TextDecoder().decode(bytes);
    for (const owner of users.filter((user) => user.role === "PROPIETARIO")) {
      expect(pdfText).not.toContain(owner.name);
      expect(pdfText).not.toContain(owner.email);
      expect(pdfText).not.toContain(owner.phone);
    }
  });
});

describe("resumen del correo", () => {
  it("incluye los filtros y ocho cifras con promedios sin datos", () => {
    const stats = computeZoneStats({ ...DEFAULT_FILTERS, period: "TODO" }, { tickets: [], history: [], units, projects, categories, crews }, new Date("2026-10-05T12:00:00Z"));
    const result = zoneStatsSummary({ stats, filters: { ...DEFAULT_FILTERS, period: "TODO" }, filterNames: { zone: zones[0].name, project: "Todas", category: "Todos", crew: "Todos" }, encargado: "Encargado" });
    expect(result.subject).toContain("Postventa Centro");
    expect(result.text).toContain("Días promedio de cierre: sin datos");
    expect(result.text).toContain("Generado desde PostventAXIS");
  });
});
