import { NextResponse, type NextRequest } from "next/server";
import { users } from "@/mocks/data";

const ROLE_HOME = {
  PROPIETARIO: "/propietario",
  ENCARGADO: "/encargado",
  ADMIN: "/admin",
} as const;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userId = request.cookies.get("pv_user_id")?.value;
  const user = users.find((item) => item.id === userId);

  if (user === undefined) {
    return pathname === "/login"
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
  }

  const roleHome = ROLE_HOME[user.role];
  const isRoleRoute = pathname === roleHome || pathname.startsWith(`${roleHome}/`);

  if (pathname === "/" || pathname === "/login" || !isRoleRoute) {
    return NextResponse.redirect(new URL(roleHome, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*|favicon.ico).*)"],
};
