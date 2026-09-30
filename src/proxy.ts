import { NextResponse, type NextRequest } from "next/server";
import { isTestMode } from "@/lib/app-mode";
import { isRole, ROLE_HOME } from "@/lib/role-home";

/** Resultado del ruteo: seguir, o redirigir a otra ruta. */
export type RouteDecision = { action: "next" } | { action: "redirect"; to: string };

/**
 * Ruteo por rol con la sesión simulada (función pura, para poder probarla). Los usuarios viven en
 * el navegador (localStorage), así que aquí solo se lee el rol desde la cookie; el cliente valida
 * que el usuario exista y esté activo. Con backend real esto pasa a validar una sesión firmada.
 *
 * - Sin sesión: `/login` siempre; `/pruebas` solo en modo pruebas; el resto va a `/login`.
 * - Con sesión: `/`, `/login` y `/pruebas` van a la home del rol, y cada rol solo ve su sección.
 * - Con el modo pruebas apagado, `/pruebas` redirige siempre a `/login`.
 */
export function decideRoute(pathname: string, userId: string | undefined, role: string | undefined, testMode: boolean): RouteDecision {
  if (pathname === "/pruebas" && !testMode) return { action: "redirect", to: "/login" };

  if (!userId || !isRole(role)) {
    const allowed = pathname === "/login" || (testMode && pathname === "/pruebas");
    return allowed ? { action: "next" } : { action: "redirect", to: "/login" };
  }

  const roleHome = ROLE_HOME[role];
  const isRoleRoute = pathname === roleHome || pathname.startsWith(`${roleHome}/`);
  if (pathname === "/" || pathname === "/login" || pathname === "/pruebas" || !isRoleRoute) {
    return { action: "redirect", to: roleHome };
  }
  return { action: "next" };
}

export function proxy(request: NextRequest) {
  const decision = decideRoute(
    request.nextUrl.pathname,
    request.cookies.get("pv_user_id")?.value,
    request.cookies.get("pv_role")?.value,
    isTestMode(),
  );
  return decision.action === "next" ? NextResponse.next() : NextResponse.redirect(new URL(decision.to, request.url));
}

export const config = {
  matcher: ["/((?!_next|.*\\..*|favicon.ico).*)"],
};
