import { fieldErrors, userSchema } from "@/lib/schemas";
import { normalize, pick, type SheetRow } from "@/lib/sheet";
import type { Project, Role, Zone } from "@/types/domain";

export const ROLE_LABEL: Record<Role, string> = {
  PROPIETARIO: "Propietario",
  ENCARGADO: "Encargado",
  ADMIN_OBRA: "Administrador de obra",
  ADMIN: "Administrador",
};

/** Plural para los filtros por rol ("Encargados", "Administradores de obra"). */
export const ROLE_LABEL_PLURAL: Record<Role, string> = {
  PROPIETARIO: "Propietarios",
  ENCARGADO: "Encargados",
  ADMIN_OBRA: "Administradores de obra",
  ADMIN: "Administradores",
};

/** Columnas de la plantilla, en orden. */
export const TEMPLATE_HEADERS = ["Nombre", "Correo", "Teléfono", "Rol", "Zonas", "Obras"] as const;

export const TEMPLATE_EXAMPLE = [
  ["María González", "mgonzalez@correo.cl", "+56 9 1234 5678", "Propietario", "", ""],
  ["Pedro Soto", "psoto@axisdc.cl", "+56 9 8765 4321", "Encargado", "Postventa Centro, Postventa Sur", ""],
  ["Lucía Pérez", "lperez@axisdc.cl", "+56 9 2468 1357", "Administrador de obra", "", "MIR"],
];

export interface ImportedUser {
  name: string;
  email: string;
  phone: string;
  role: Role;
  zoneIds: string[];
  projectIds: string[];
}

export interface ImportRow {
  /** Fila en la planilla (la 1 es el encabezado). */
  line: number;
  name: string;
  email: string;
  roleText: string;
  zonesText: string;
  user: ImportedUser | null;
  errors: string[];
}

function parseRole(text: string): Role | null {
  const value = normalize(text);
  if (value.startsWith("propietari")) return "PROPIETARIO";
  if (value.startsWith("encargad")) return "ENCARGADO";
  if (/^admin(istrador)?s+des+obra|^admins*obra/.test(value)) return "ADMIN_OBRA";
  if (value.startsWith("admin") || value.startsWith("superadmin")) return "ADMIN";
  return null;
}

/** Acepta "Postventa Centro", "Zona Centro" o solo "Centro", separadas por coma o punto y coma. */
function parseZones(text: string, zones: Zone[]): { ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const part of text.split(/[,;]/).map((item) => item.trim()).filter(Boolean)) {
    const wanted = normalize(part).replace(/^(zona|postventa)\s+/, "");
    const zone = zones.find((item) => normalize(item.name).replace(/^(zona|postventa)\s+/, "") === wanted);
    if (zone) ids.push(zone.id);
    else unknown.push(part);
  }
  return { ids: [...new Set(ids)], unknown };
}

/**
 * Valida las filas leídas de la planilla. Marca como error los correos que ya existen
 * en el sistema o que se repiten dentro del mismo archivo.
 */
/** Obras por código ("MIR") o nombre ("Edificio Mirador Central"), separadas por coma. */
function parseProjects(text: string, projects: Project[]): { ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const part of text.split(/[,;]/).map((item) => item.trim()).filter(Boolean)) {
    const wanted = normalize(part);
    const project = projects.find((item) => normalize(item.code) === wanted || normalize(item.name) === wanted);
    if (project) ids.push(project.id);
    else unknown.push(part);
  }
  return { ids: [...new Set(ids)], unknown };
}

export function validateImport(rows: SheetRow[], zones: Zone[], existingEmails: string[], projects: Project[] = []): ImportRow[] {
  const taken = new Set(existingEmails.map((email) => email.toLowerCase()));
  const seen = new Set<string>();

  return rows
    .map((row, index) => ({ row, line: index + 2 }))
    .filter(({ row }) => TEMPLATE_HEADERS.some((header) => pick(row, header) !== ""))
    .map(({ row, line }) => {
      const name = pick(row, "Nombre");
      const email = pick(row, "Correo").toLowerCase();
      const phone = pick(row, "Teléfono");
      const roleText = pick(row, "Rol");
      const zonesText = pick(row, "Zonas");
      const role = parseRole(roleText);
      const { ids, unknown } = parseZones(zonesText, zones);
      const projectsText = pick(row, "Obras");
      const parsedProjects = parseProjects(projectsText, projects);

      const errors: string[] = [];
      const result = userSchema.safeParse({ name, email, phone, role: role ?? roleText, zoneIds: role === "ENCARGADO" ? ids : [],
        projectIds: role === "ADMIN_OBRA" ? parsedProjects.ids : [],
      });
      if (!result.success) errors.push(...Object.values(fieldErrors(result.error)));
      if (unknown.length > 0 && role === "ENCARGADO") errors.push(`Zona desconocida: ${unknown.join(", ")}.`);
      if (parsedProjects.unknown.length > 0 && role === "ADMIN_OBRA") {
        errors.push(`Obra desconocida: ${parsedProjects.unknown.join(", ")}.`);
      }
      if (email && taken.has(email)) errors.push("Ese correo ya está registrado.");
      if (email && seen.has(email)) errors.push("Correo repetido en la planilla.");
      if (email) seen.add(email);

      return {
        line,
        name,
        email,
        roleText,
        zonesText,
        user: errors.length === 0 && result.success ? result.data : null,
        errors,
      };
    });
}
