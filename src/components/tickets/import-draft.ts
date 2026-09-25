/**
 * Borrador editable de cada requerimiento leído de un documento: lo que el encargado revisa y
 * confirma antes de registrarlo. Se arma cruzando lo leído con obras, unidades y propietarios.
 */
import { matchCategory, matchOwner, matchProject, matchUnit, parseUnitHint } from "@/lib/document-import/match";
import { findTicketByRefs } from "@/lib/document-import/plan";
import { sentenceCase, type ParsedDocument, type ParsedRequirement } from "@/lib/document-import/types";
import type { Project, Ticket, TicketCategory, Unit, UnitType, User } from "@/types/domain";

export interface ImportDraft {
  key: string;
  include: boolean;
  parsed: ParsedRequirement;
  projectId: string;
  unitMode: "existing" | "new";
  unitId: string;
  newUnit: { type: UnitType; tower: string; number: string };
  ownerMode: "existing" | "new";
  ownerId: string;
  newOwner: { name: string; email: string; phone: string };
  categoryId: string;
  room: string;
  description: string;
  /** Ticket que ya tiene una referencia del documento: se avanza en vez de crear uno nuevo. */
  linkedTicketId: string | null;
}

export interface DraftSources {
  projects: Project[];
  units: Unit[];
  users: User[];
  categories: TicketCategory[];
  tickets: Ticket[];
}

function titleCaseName(value: string | null): string {
  if (!value) return "";
  return value
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .map((word) => word.charAt(0).toLocaleUpperCase("es") + word.slice(1))
    .join(" ");
}

export function buildDrafts(document: ParsedDocument, sources: DraftSources): ImportDraft[] {
  return document.requirements.map((parsed, index) => {
    const linked = parsed.externalRefs.length > 0 ? findTicketByRefs(sources.tickets, parsed.externalRefs) : undefined;
    const linkedUnit = linked ? sources.units.find((unit) => unit.id === linked.unitId) : undefined;
    const project = linkedUnit
      ? sources.projects.find((item) => item.id === linkedUnit.projectId) ?? null
      : matchProject(parsed.projectHint, sources.projects);
    const projectUnits = project ? sources.units.filter((unit) => unit.projectId === project.id) : [];
    const unit = linkedUnit ?? matchUnit(parsed.unitHint, projectUnits);
    const owner = matchOwner(parsed.ownerEmail, sources.users, unit);
    const hint = parseUnitHint(parsed.unitHint);
    const category = matchCategory([parsed.item, parsed.problem, parsed.description], sources.categories);
    const description = parsed.description ?? [parsed.item, parsed.problem].filter(Boolean).join(": ");

    return {
      key: `${index}-${parsed.externalRefs.join("|")}`,
      include: true,
      parsed,
      projectId: project?.id ?? "",
      unitMode: unit || !project ? "existing" : "new",
      unitId: unit?.id ?? "",
      newUnit: { type: hint?.type ?? "CASA", tower: hint?.tower ?? "", number: hint?.number ?? "" },
      ownerMode: owner ? "existing" : "new",
      ownerId: owner?.id ?? "",
      newOwner: {
        name: titleCaseName(parsed.ownerName),
        email: parsed.ownerEmail ?? "",
        phone: parsed.ownerPhone ?? "",
      },
      categoryId: linked?.categoryId ?? category?.id ?? "",
      room: linked?.room ?? (parsed.room ? sentenceCase(parsed.room) : ""),
      description: linked?.description ?? description,
      linkedTicketId: linked?.id ?? null,
    };
  });
}

/** Errores de un borrador que impiden registrarlo (en español, por campo). */
export function draftErrors(draft: ImportDraft): Record<string, string> {
  if (draft.linkedTicketId) return {};
  const errors: Record<string, string> = {};
  if (!draft.projectId) errors.project = "Elige la obra.";
  if (draft.unitMode === "existing" && !draft.unitId) errors.unit = "Elige la unidad o crea una nueva.";
  if (draft.unitMode === "new") {
    if (!draft.newUnit.number.trim()) errors.unit = "Indica el número de la unidad nueva.";
    if (draft.ownerMode === "existing" && !draft.ownerId) errors.owner = "Elige el propietario o crea uno nuevo.";
    if (draft.ownerMode === "new") {
      if (!draft.newOwner.name.trim()) errors.owner = "Indica el nombre del propietario.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.newOwner.email.trim())) errors.owner = "Indica un correo válido del propietario.";
      else if (!draft.newOwner.phone.trim()) errors.owner = "Indica el teléfono del propietario.";
    }
  }
  if (!draft.categoryId) errors.category = "Elige el origen de la falla.";
  if (!draft.room.trim()) errors.room = "Indica el recinto.";
  if (draft.description.trim().length < 10) errors.description = "Describe la falla (mínimo 10 caracteres).";
  return errors;
}
