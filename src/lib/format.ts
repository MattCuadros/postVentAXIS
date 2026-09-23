import type { Unit } from "@/types/domain";

const shortDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long" });

/** Las fechas sin hora ("2026-09-25") se leen a mediodía para no correrse de día por zona horaria. */
function toDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

/** "20 sept" */
export function formatShortDate(iso: string): string {
  return shortDate.format(toDate(iso)).replace(".", "");
}

/** "14 de agosto" */
export function formatLongDate(iso: string): string {
  return longDate.format(toDate(iso));
}

/** "Torre A 704" para departamentos, "Casa 12" para casas. */
export function unitLabel(unit: Unit): string {
  if (unit.type === "CASA") return `Casa ${unit.number}`;
  return unit.tower === null ? `Depto. ${unit.number}` : `Torre ${unit.tower} ${unit.number}`;
}
