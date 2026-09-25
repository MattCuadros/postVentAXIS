import { daysOpen, todayIso, unitLabel } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/ticket-status";
import type { Project, Ticket, TicketCategory, Unit, User, WorkCrew, Zone } from "@/types/domain";

interface ExportSources {
  tickets: Ticket[];
  units: Unit[];
  projects: Project[];
  zones: Zone[];
  categories: TicketCategory[];
  users: User[];
  crews: WorkCrew[];
}

/** Descarga los requerimientos como Excel. `xlsx` se carga solo al exportar. */
export async function exportTicketsToExcel(sources: ExportSources): Promise<void> {
  const { tickets, units, projects, zones, categories, users, crews } = sources;
  const XLSX = await import("xlsx");

  const rows = tickets.map((ticket) => {
    const unit = units.find((item) => item.id === ticket.unitId);
    const project = projects.find((item) => item.id === unit?.projectId);
    return {
      Folio: ticket.folio,
      Estado: STATUS_LABEL[ticket.status],
      Obra: project?.name ?? "",
      Unidad: unit ? unitLabel(unit) : "",
      Zona: zones.find((item) => item.id === project?.zoneId)?.name ?? "",
      "Categoría reportada": categories.find((item) => item.id === ticket.reportedCategoryId)?.name ?? "",
      "Categoría confirmada": categories.find((item) => item.id === ticket.categoryId)?.name ?? "",
      Recinto: ticket.room,
      Descripción: ticket.description,
      Propietario: users.find((item) => item.id === unit?.ownerId)?.name ?? "",
      Encargado: users.find((item) => item.id === ticket.encargadoId)?.name ?? "",
      Equipo: crews.find((item) => item.id === ticket.crewId)?.name ?? "",
      Ingresado: ticket.createdAt.slice(0, 10),
      "Visita inspectiva": ticket.visitDate ?? "",
      "Trabajo programado": ticket.scheduledDate ?? "",
      "Días abierto": daysOpen(ticket),
      "Motivo no procede": ticket.rejectionReason ?? "",
      "Caso especial": ticket.specialCase ? "Sí" : "No",
      "Motivo caso especial": ticket.specialCase?.reason ?? "",
    };
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Requerimientos");
  XLSX.writeFile(book, `postventaxis-requerimientos-${todayIso()}.xlsx`);
}
