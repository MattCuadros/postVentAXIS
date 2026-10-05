import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { STATUS_LABEL } from "@/lib/ticket-status";
import { STALE_DAYS, STATS_PERIOD_LABEL } from "@/lib/zone-stats";
import type { ZoneStatsExportContext } from "@/lib/export-zone-stats";

const BLUE = rgb(0, 0.2, 0.6);
const ORANGE = rgb(1, 0.4, 0);
const GREY = rgb(0.8, 0.8, 0.8);
const BLACK = rgb(0.1, 0.1, 0.1);
const fmt = (value: number | null) => value === null ? "sin datos" : new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value);
export async function buildZoneStatsPdf(ctx: { stats: { start: string | Date | null; end: string | Date; ingresados: number; abiertos: number; atrasados: number; cerradosEnPeriodo: number; avgDaysToVisit: number | null; avgDaysToClose: number | null; enRecepcion: number; noProcede: number; byStatus: { label: string; count: number }[]; byCategory: { label: string; count: number }[]; byProject: { label: string; count: number }[]; byCrew: { label: string; count: number }[]; rows: { folio: string; unit: string; days: number; status: keyof typeof STATUS_LABEL }[] }; filters: ZoneStatsExportContext["filters"]; filterNames: ZoneStatsExportContext["filterNames"]; encargado: string }): Promise<{ bytes: Uint8Array; filename: string }> {
  const { stats, filters, filterNames, encargado } = ctx;
  const end = new Date(stats.end);
  const start = stats.start === null ? null : new Date(stats.start);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Estadisticas PostventAXIS");
  pdf.setAuthor("PostventAXIS");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoPath = path.join(process.cwd(), "public", "brand", "logo-axis-600.png");
  const logo = await pdf.embedPng(await readFile(logoPath));
  const page = pdf.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width: width * 0.58, height: 7, color: GREY });
  page.drawRectangle({ x: width * 0.58, y: 0, width: width * 0.3, height: 7, color: BLUE });
  page.drawRectangle({ x: width * 0.88, y: 0, width: width * 0.12, height: 7, color: ORANGE });
  const logoDims = logo.scale(0.2);
  page.drawImage(logo, { x: width - logoDims.width - 36, y: height - logoDims.height - 24, ...logoDims });
  let y = height - 48;
  const line = (text: string, size = 10, strong = false, color = BLACK, x = 36) => {
    page.drawText(text, { x, y, size, font: strong ? bold : font, color, maxWidth: width - x - 40 });
    y -= size + 5;
  };
  line("Estadisticas de postventa", 20, true, BLUE);
  line(`${filterNames.zone || "Todas mis zonas"}  |  ${filterNames.project || "Todas las obras"}  |  ${STATS_PERIOD_LABEL[filters.period]}`, 11, true);
  const range = start ? `${start.toLocaleDateString("es-CL")} al ${end.toLocaleDateString("es-CL")}` : `Hasta el ${end.toLocaleDateString("es-CL")}`;
  line(`Periodo: ${range}  |  Origen: ${filterNames.category || "Todos"}  |  Equipo: ${filterNames.crew || "Todos"}  |  Estado: ${filters.status}`);
  line(`Encargado: ${encargado}  |  Generado: ${new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeStyle: "short", timeZone: "America/Santiago" }).format(end)}`);
  y -= 7;
  const metrics = [
    ["Ingresados", String(stats.ingresados)], ["Abiertos", String(stats.abiertos)], [`Abiertos > ${STALE_DAYS} días`, String(stats.atrasados)], ["Cierres conformes", String(stats.cerradosEnPeriodo)],
    ["Días hasta visita (prom.)", fmt(stats.avgDaysToVisit)], ["Días de cierre (prom.)", fmt(stats.avgDaysToClose)], ["Esperando conformidad", String(stats.enRecepcion)], ["No procede", String(stats.noProcede)],
  ];
  metrics.forEach(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = 36 + col * 194;
    const top = y - row * 52;
    page.drawRectangle({ x, y: top - 34, width: 180, height: 43, color: rgb(0.95, 0.95, 0.95), borderColor: GREY, borderWidth: 0.6 });
    page.drawText(label, { x: x + 8, y: top - 6, size: 8, font, color: BLACK });
    page.drawText(value, { x: x + 8, y: top - 25, size: 14, font: bold, color: BLUE });
  });
  y -= 112;
  const section = (title: string, rows: { label: string; count: number }[], x: number, top: number, maxRows = 5) => {
    page.drawText(title, { x, y: top, size: 10, font: bold, color: BLUE });
    rows.slice(0, maxRows).forEach((row, index) => page.drawText(`${row.label}: ${row.count}`, { x, y: top - 15 - index * 11, size: 7.5, font, color: BLACK, maxWidth: 190 }));
  };
  section("Por estado", stats.byStatus, 36, y);
  section("Por origen", stats.byCategory, 246, y);
  section("Por obra", stats.byProject, 456, y);
  section("Por equipo", stats.byCrew, 666, y);
  y -= 83;
  page.drawText(`Requerimientos abiertos hace más de ${STALE_DAYS} días`, { x: 36, y, size: 11, font: bold, color: BLUE });
  y -= 17;
  page.drawText("Folio                         Unidad                     Días       Estado", { x: 36, y, size: 8, font: bold, color: BLACK });
  y -= 13;
  const overdue = stats.rows.filter((item) => item.status !== "CERRADO" && item.status !== "NO_PROCEDE" && item.days > STALE_DAYS).slice(0, 8);
  for (const row of overdue) {
    page.drawText(`${row.folio.padEnd(25)}${row.unit.padEnd(28)}${Math.floor(row.days).toString().padEnd(11)}${STATUS_LABEL[row.status]}`, { x: 36, y, size: 8, font, color: BLACK, maxWidth: width - 72 });
    y -= 12;
  }
  if (!overdue.length) page.drawText("Sin requerimientos atrasados.", { x: 36, y, size: 8, font, color: BLACK });
  page.drawRectangle({ x: 36, y: 12, width: width - 72, height: 3, color: BLUE });
  page.drawText("Construimos cambios que trascienden para el futuro sostenible de nuestra sociedad.", { x: 36, y: 20, size: 7, font, color: BLUE });
  page.drawText("www.axisdc.cl", { x: width - 105, y: 20, size: 7, font, color: BLUE });
  const filename = `estadisticas-postventaxis-${filters.period.toLowerCase()}-${end.toISOString().slice(0, 10)}.pdf`;
  return { bytes: await pdf.save(), filename };
}
