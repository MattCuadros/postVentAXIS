/**
 * Fuente única de verdad para quién puede ver, reportar y firmar por una unidad: el titular
 * (`Unit.ownerId`) y sus responsables (`UnitResponsible[]`: familiares, representante, comité).
 * Funciones puras, usadas tanto por la interfaz como por la capa `src/data/`.
 */
import type { Project, ResponsibleRelation, Unit, UnitResponsible, User } from "@/types/domain";

export const RESPONSIBLE_RELATION_LABEL: Record<ResponsibleRelation, string> = {
  FAMILIAR: "Familiar",
  REPRESENTANTE: "Representante",
  ADMIN_COMITE: "Administrador del comité",
  OTRO: "Otro",
};

/** El detalle (relationNote) es obligatorio para estas dos relaciones. */
export function relationNeedsNote(relation: ResponsibleRelation): boolean {
  return relation === "FAMILIAR" || relation === "OTRO";
}

function responsiblesOfUnit(unitId: string, responsibles: UnitResponsible[]): UnitResponsible[] {
  return responsibles.filter((item) => item.unitId === unitId);
}

/** Unidades donde la persona es titular o responsable. */
export function unitsForUser(user: User, units: Unit[], responsibles: UnitResponsible[]): Unit[] {
  const responsibleUnitIds = new Set(responsibles.filter((item) => item.userId === user.id).map((item) => item.unitId));
  return units.filter((unit) => unit.ownerId === user.id || responsibleUnitIds.has(unit.id));
}

/** true si la persona puede ver y reportar requerimientos de esa unidad (titular o cualquier responsable). */
export function hasAccessToUnit(user: User, unit: Unit, responsibles: UnitResponsible[]): boolean {
  if (unit.ownerId === user.id) return true;
  return responsiblesOfUnit(unit.id, responsibles).some((item) => item.userId === user.id);
}

/** true si puede firmar la conformidad: el titular, o un responsable con `canSignConformity`. */
export function canSignForUnit(user: User, unit: Unit, responsibles: UnitResponsible[]): boolean {
  if (unit.ownerId === user.id) return true;
  return responsiblesOfUnit(unit.id, responsibles).some((item) => item.userId === user.id && item.canSignConformity);
}

/** true si al menos una persona (titular o responsable) puede firmar la conformidad de la unidad. */
export function someoneCanSign(unit: Unit, responsibles: UnitResponsible[]): boolean {
  if (unit.ownerId !== null) return true;
  return responsiblesOfUnit(unit.id, responsibles).some((item) => item.canSignConformity);
}

/** "Titular" o la calidad del responsable ("Familiar (hijo)", "Administrador del comité"). */
export function capacityOf(user: User, unit: Unit, responsibles: UnitResponsible[]): string {
  if (unit.ownerId === user.id) return "Titular";
  const responsible = responsiblesOfUnit(unit.id, responsibles).find((item) => item.userId === user.id);
  if (!responsible) return "Titular";
  const label = RESPONSIBLE_RELATION_LABEL[responsible.relation];
  return relationNeedsNote(responsible.relation) && responsible.relationNote ? `${label} (${responsible.relationNote})` : label;
}

/**
 * Calidad de quien actuó, para guardar en el historial como texto fijo; null si esa persona no
 * es propietaria ni responsable de la unidad (ej. personal Axis, que no tiene "calidad").
 */
export function actorCapacityFor(user: User, unit: Unit, responsibles: UnitResponsible[]): string | null {
  if (user.role !== "PROPIETARIO") return null;
  if (!hasAccessToUnit(user, unit, responsibles)) return null;
  return capacityOf(user, unit, responsibles);
}

/** Solo el superadministrador y el encargado de la zona de la unidad pueden gestionar sus responsables. */
export function canManageResponsibles(actor: User, unit: Unit, projects: Project[]): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "ENCARGADO") return false;
  const project = projects.find((item) => item.id === unit.projectId);
  return project !== undefined && actor.zoneIds.includes(project.zoneId);
}
