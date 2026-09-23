import { fieldErrors, userSchema } from "@/lib/schemas";
import { normalize, pick, type SheetRow } from "@/lib/sheet";
import type { Role, Zone } from "@/types/domain";

export const ROLE_LABEL: Record<Role, string> = {
  PROPIETARIO: "Propietario",
  ENCARGADO: "Encargado",
  ADMIN: "Administrador",
};

/** Columnas de la plantilla, en orden. */
export const TEMPLATE_HEADERS = ["Nombre", "Correo", "Teléfono", "Rol", "Zonas"] as const;

export const TEMPLATE_EXAMPLE = [
  ["María González", "mgonzalez@correo.cl", "+56 9 1234 5678", "Propietario", ""],
  ["Pedro Soto", "psoto@axisdc.cl", "+56 9 8765 4321", "Encargado", "Zona Centro, Zona Sur"],
];

export interface ImportedUser {
  name: string;
  email: string;
  phone: string;
  role: Role;
  zoneIds: string[];
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
  if (value.startsWith("admin") || value.startsWith("superadmin")) return "ADMIN";
  return null;
}

/** Acepta "Zona Centro" o solo "Centro", separadas por coma o punto y coma. */
function parseZones(text: string, zones: Zone[]): { ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const part of text.split(/[,;]/).map((item) => item.trim()).filter(Boolean)) {
    const wanted = normalize(part).replace(/^zona\s+/, "");
    const zone = zones.find((item) => normalize(item.name).replace(/^zona\s+/, "") === wanted);
    if (zone) ids.push(zone.id);
    else unknown.push(part);
  }
  return { ids: [...new Set(ids)], unknown };
}

/**
 * Valida las filas leídas de la planilla. Marca como error los correos que ya existen
 * en el sistema o que se repiten dentro del mismo archivo.
 */
export function validateImport(rows: SheetRow[], zones: Zone[], existingEmails: string[]): ImportRow[] {
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

      const errors: string[] = [];
      const result = userSchema.safeParse({ name, email, phone, role: role ?? roleText, zoneIds: role === "ENCARGADO" ? ids : [] });
      if (!result.success) errors.push(...Object.values(fieldErrors(result.error)));
      if (unknown.length > 0 && role === "ENCARGADO") errors.push(`Zona desconocida: ${unknown.join(", ")}.`);
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
