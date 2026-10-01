import type { Role } from "@/types/domain";

/** Home de cada rol tras iniciar sesión. */
export const ROLE_HOME: Record<Role, string> = {
  PROPIETARIO: "/propietario",
  ENCARGADO: "/encargado",
  ADMIN_OBRA: "/admin-obra",
  ADMIN: "/admin",
};

export function isRole(value: string | undefined): value is Role {
  return value !== undefined && value in ROLE_HOME;
}
