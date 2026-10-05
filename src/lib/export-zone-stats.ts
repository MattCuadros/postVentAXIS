import { todayIso, unitLabel } from "@/lib/format";
import type { CountRow } from "@/lib/metrics";
import { STATUS_LABEL } from "@/lib/ticket-status";
import { STALE_DAYS, STATS_PERIOD_LABEL, STATUS_GROUP_LABEL, type StatsFilters, type ZoneStats } from "@/lib/zone-stats";

export interface ZoneStatsExportContext {
  stats: ZoneStats;
  filters: StatsFilters;
  /** Nombres legibles de los filtros elegidos (zona, obra, origen, equipo). */
  filterNames: { zone: string; project: string; category: string; crew: string };
  encargado: string;
}
export type ExportContext = ZoneStatsExportContext;

const dateFormat = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
const round1 = (value: number | null) => (value === null ? "" : Math.round(value * 10) / 10);
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function slug(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Construye el mismo libro Excel sin iniciar una descarga. */
export async function buildZoneStatsWorkbook({ stats, filters, filterNames, encargado }: ExportContext) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();

  const add = (name: string, rows: (string | number)[][], widths: number[]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(book, sheet, name);
  };
  const breakdown = (title: string, rows: CountRow[]) => {
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return [[title, "Requerimientos", "% del total"], ...rows.map((row) => [row.label, row.count, total === 0 ? 0 : Math.round((row.count / total) * 1000) / 10])];
  };

  const range = stats.start ? `${dateFormat.format(stats.start)} al ${dateFormat.format(stats.end)}` : `Hasta el ${dateFormat.format(stats.end)}`;
  add(
    "Resumen",
    [
      ["Estadísticas de postventa · PostventAXIS"],
      [],
      ["Encargado", encargado],
      ["Período", `${STATS_PERIOD_LABEL[filters.period]} (${range})`],
      ["Zona", filterNames.zone],
      ["Obra", filterNames.project],
      ["Origen de la falla", filterNames.category],
      ["Equipo", filterNames.crew],
      ["Estado", STATUS_GROUP_LABEL[filters.status]],
      [],
      ["Indicador", "Valor"],
      ["Ingresados en el período", stats.ingresados],
      ["Abiertos", stats.abiertos],
      [`Abiertos hace más de ${STALE_DAYS} días`, stats.atrasados],
      ["Esperando conformidad del propietario", stats.enRecepcion],
      ["Cerrados conformes", stats.cerrados],
      ["Cierres conformes dentro del período", stats.cerradosEnPeriodo],
      ["No procede", stats.noProcede],
      ["Casos especiales", stats.casosEspeciales],
      ["Origen reclasificado en la visita", stats.reclasificados],
      ["Rechazos del propietario en la recepción", stats.ownerRejections],
      ["Días promedio hasta la visita inspectiva", round1(stats.avgDaysToVisit)],
      ["Días promedio de cierre", round1(stats.avgDaysToClose)],
    ],
    [42, 48],
  );
  add("Tendencia", [["Tramo", "Ingresados", "Cerrados"], ...stats.trend.map((row) => [row.label, row.ingresados, row.cerrados])], [16, 12, 12]);
  add("Por estado", breakdown("Estado", stats.byStatus), [28, 16, 12]);
  add("Por origen", breakdown("Origen de la falla", stats.byCategory), [28, 16, 12]);
  add("Por obra", breakdown("Obra", stats.byProject), [32, 16, 12]);
  add("Por equipo", breakdown("Equipo", stats.byCrew), [32, 16, 12]);
  add(
    "Requerimientos",
    [
      [
        "Folio", "Estado", "Obra", "Unidad", "Recinto", "Origen reportado", "Origen confirmado", "Equipo", "Ingresado",
        "Visita inspectiva", "Trabajo programado", "Cerrado", "Días", "Días a la visita", "Rechazos del propietario",
        "Caso especial", "Motivo no procede", "Descripción",
      ],
      ...stats.rows.map((row) => [
        row.ticket.folio,
        STATUS_LABEL[row.ticket.status],
        row.project,
        row.unit ? unitLabel(row.unit) : "",
        row.ticket.room,
        row.reportedCategory,
        row.category,
        row.crew,
        day(row.ticket.createdAt),
        row.ticket.visitDate ?? "",
        row.ticket.scheduledDate ?? "",
        day(row.closedAt),
        round1(row.days),
        round1(row.daysToVisit),
        row.ownerRejections,
        row.ticket.specialCase ? "Sí" : "No",
        row.ticket.rejectionReason ?? "",
        row.ticket.description,
      ]),
    ],
    [14, 20, 26, 16, 14, 20, 20, 26, 12, 14, 14, 12, 8, 10, 12, 10, 30, 60],
  );

  return { book, filename: `estadisticas-${slug(filterNames.zone)}-${slug(STATS_PERIOD_LABEL[filters.period])}-${todayIso()}.xlsx` };
}

export async function exportZoneStatsToExcel(ctx: ExportContext): Promise<void> {
  const { book, filename } = await buildZoneStatsWorkbook(ctx);
  const XLSX = await import("xlsx");
  XLSX.writeFile(book, filename);
}

export function zoneStatsSummary({ stats, filters, filterNames, encargado }: ExportContext): { subject: string; text: string } {
  const zone = filterNames.zone || "Todas mis zonas";
  const project = filterNames.project || "Todas";
  const range = stats.start ? `${dateFormat.format(stats.start)} al ${dateFormat.format(stats.end)}` : `Hasta el ${dateFormat.format(stats.end)}`;
  const metrics = [
    ["Ingresados", String(stats.ingresados)], ["Abiertos", String(stats.abiertos)],
    [`Abiertos hace más de ${STALE_DAYS} días`, String(stats.atrasados)], ["Cierres conformes en el período", String(stats.cerradosEnPeriodo)],
    ["Días promedio hasta la visita", round1(stats.avgDaysToVisit) === "" ? "sin datos" : String(round1(stats.avgDaysToVisit))],
    ["Días promedio de cierre", round1(stats.avgDaysToClose) === "" ? "sin datos" : String(round1(stats.avgDaysToClose))],
    ["Esperando conformidad", String(stats.enRecepcion)], ["No procede", String(stats.noProcede)],
  ];
  return {
    subject: `Estadísticas PostventAXIS · ${zone} · ${project} · ${STATS_PERIOD_LABEL[filters.period]}`,
    text: ["Informe de estadísticas PostventAXIS", `Zona: ${zone}`, `Obra: ${project}`, `Origen: ${filterNames.category || "Todos"}`, `Equipo: ${filterNames.crew || "Todos"}`, `Estado: ${STATUS_GROUP_LABEL[filters.status]}`, `Período: ${STATS_PERIOD_LABEL[filters.period]} (${range})`, "", ...metrics.map(([label, value]) => `${label}: ${value}`), "", `Encargado: ${encargado}`, `Generado: ${new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeStyle: "short", timeZone: "America/Santiago" }).format(stats.end)}`, "Generado desde PostventAXIS"].join("\n"),
  };
}
