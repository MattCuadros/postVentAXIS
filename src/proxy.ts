import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/types/domain";

const ROLE_HOME: Record<Role, string> = {
  PROPIETARIO: "/propietario",
  ENCARGADO: "/encargado",
  ADMIN: "/admin",
  ADMIN_OBRA: "/admin-obra",
};

function isRole(value: string | undefined): value is Role {
  return value !== undefined && value in ROLE_HOME;
}

/**
 * Ruteo por rol con la sesión simulada. Los usuarios viven en el navegador (localStorage), así que
 * aquí solo se lee el rol desde la cookie; el cliente valida que el usuario exista y esté activo.
 * Con backend real esto pasa a validar una sesión firmada.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = request.cookies.get("pv_user_id")?.value;
  const role = request.cookies.get("pv_role")?.value;

  if (!userId || !isRole(role)) {
    return pathname === "/login"
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
  }

  const roleHome = ROLE_HOME[role];
  const isRoleRoute = pathname === roleHome || pathname.startsWith(`${roleHome}/`);

  if (pathname === "/" || pathname === "/login" || !isRoleRoute) {
    return NextResponse.redirect(new URL(roleHome, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*|favicon.ico).*)"],
};
