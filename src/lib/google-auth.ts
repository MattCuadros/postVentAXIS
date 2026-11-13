import { isRole } from "@/lib/role-home";
import type { Role, User } from "@/types/domain";

/** Dominio de Google Workspace sugerido en la pantalla de Google. La regla real la aplica la base de datos. */
export const WORKSPACE_DOMAIN = "axisdc.cl";

/** Resultado de `link_google_user()` / motivo por el que un ingreso con Google no prospera. */
export type GoogleLoginError = "SIN_GOOGLE" | "DOMINIO" | "NO_REGISTRADO" | "INACTIVO" | "CANCELADO" | "ERROR";

const ERRORS: GoogleLoginError[] = ["SIN_GOOGLE", "DOMINIO", "NO_REGISTRADO", "INACTIVO", "CANCELADO", "ERROR"];

export function parseGoogleLoginError(value: string | null | undefined): GoogleLoginError | null {
  if (!value) return null;
  return ERRORS.find((item) => item === value) ?? "ERROR";
}

export function googleLoginErrorMessage(error: GoogleLoginError): string {
  switch (error) {
    case "DOMINIO":
      return `Ingresa con tu cuenta de Google Workspace de Axis (@${WORKSPACE_DOMAIN}).`;
    case "NO_REGISTRADO":
      return "Tu correo aún no está dado de alta en PostventAXIS. Pídele al superadministrador que te registre.";
    case "INACTIVO":
      return "Tu usuario está desactivado. Consulta con el superadministrador.";
    case "CANCELADO":
      return "No se completó el ingreso con Google. Inténtalo de nuevo.";
    case "SIN_GOOGLE":
    case "ERROR":
      return "No pudimos completar el ingreso con Google. Inténtalo de nuevo.";
  }
}

/** Respuesta de `link_google_user()`: OK con el usuario del directorio, o el motivo del rechazo. */
export function readLinkResult(data: unknown): { ok: true; userId: string; role: Role } | { ok: false; error: GoogleLoginError } {
  if (typeof data !== "object" || data === null) return { ok: false, error: "ERROR" };
  const { status, id, role } = data as Record<string, unknown>;
  if (status === "OK" && typeof id === "string" && isRole(typeof role === "string" ? role : undefined)) {
    return { ok: true, userId: id, role: role as Role };
  }
  return { ok: false, error: status === "OK" ? "ERROR" : parseGoogleLoginError(typeof status === "string" ? status : null) ?? "ERROR" };
}

/** Perfil del directorio (`session_profile()`) como `User` de la app; null si no es válido. */
export function readProfile(data: unknown): User | null {
  if (typeof data !== "object" || data === null) return null;
  const row = data as Record<string, unknown>;
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.email !== "string") return null;
  if (!isRole(typeof row.role === "string" ? row.role : undefined)) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: typeof row.phone === "string" ? row.phone : "",
    role: row.role as Role,
    zoneIds: strings(row.zone_ids),
    projectIds: strings(row.project_ids),
    active: row.active === true,
  };
}
