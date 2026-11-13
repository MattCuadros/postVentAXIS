import { NextResponse, type NextRequest } from "next/server";
import { isTestMode } from "@/lib/app-mode";
import { isRole, ROLE_HOME } from "@/lib/role-home";
import { isGoogleLoginConfigured } from "@/lib/supabase/config";
import { supabaseServer, type CookieToSet } from "@/lib/supabase/server";

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
  // Vuelta de Google y cierre del ingreso: se resuelven solos, con o sin sesión.
  if (pathname.startsWith("/auth/")) return { action: "next" };

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

/**
 * Fuera del modo pruebas las cookies simuladas no bastan: el usuario y el rol salen de la sesión
 * de Supabase (verificada por la base de datos en `session_profile`), y las cookies se corrigen
 * si no coinciden. En modo pruebas se mantiene la sesión simulada, que es la que usa /pruebas.
 */
async function verifiedSession(request: NextRequest): Promise<{ userId?: string; role?: string; cookies: CookieToSet[] }> {
  const cookies: CookieToSet[] = [];
  const hasSession = request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
  if (!hasSession) return { cookies };
  try {
    const supabase = supabaseServer(() => request.cookies.getAll(), (items) => cookies.push(...items));
    await supabase.auth.getClaims(); // renueva el token si venció
    const { data } = await supabase.rpc("session_profile");
    const profile = data as { id?: string; role?: string; active?: boolean } | null;
    return profile?.active ? { userId: profile.id, role: profile.role, cookies } : { cookies };
  } catch {
    return { cookies };
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const testMode = isTestMode();
  // Si Supabase devuelve el código de Google a la URL del sitio en vez de a /auth/callback
  // (cuando esa ruta no está en su lista de redirecciones), se completa el ingreso igual.
  if ((pathname === "/" || pathname === "/login") && request.nextUrl.searchParams.has("code")) {
    return NextResponse.redirect(new URL(`/auth/callback${request.nextUrl.search}`, request.url));
  }
  const strict = !testMode && isGoogleLoginConfigured() && !pathname.startsWith("/auth/");
  const session = strict
    ? await verifiedSession(request)
    : { userId: request.cookies.get("pv_user_id")?.value, role: request.cookies.get("pv_role")?.value, cookies: [] };

  const decision = decideRoute(pathname, session.userId, session.role, testMode);
  const response = decision.action === "next" ? NextResponse.next() : NextResponse.redirect(new URL(decision.to, request.url));
  session.cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  if (strict) {
    for (const [name, value] of [["pv_user_id", session.userId], ["pv_role", session.role]] as const) {
      if (request.cookies.get(name)?.value === value) continue;
      if (value) response.cookies.set(name, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
      else response.cookies.delete(name);
    }
  }
  return response;
}

export const config = {
  // /api queda fuera: son proxies sin sesión (geocodificación y enlaces de Maps), no páginas por rol.
  matcher: ["/((?!api/|_next|.*\\..*|favicon.ico).*)"],
};
