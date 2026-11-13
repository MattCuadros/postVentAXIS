import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readLinkResult, type GoogleLoginError } from "@/lib/google-auth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Vuelta desde Google (flujo PKCE de Supabase Auth): cambia el código por la sesión y pide a la
 * base de datos vincular la cuenta con el directorio (`link_google_user`, que exige identidad de
 * Google verificada, dominio permitido y usuario activo). Si no corresponde, cierra la sesión.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (error: GoogleLoginError) => NextResponse.redirect(new URL(`/login?error=${error}`, url.origin));
  const code = url.searchParams.get("code");
  if (!code) return fail(url.searchParams.has("error") ? "CANCELADO" : "ERROR");

  const store = await cookies();
  const supabase = supabaseServer(
    () => store.getAll(),
    (items) => items.forEach(({ name, value, options }) => store.set(name, value, options)),
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return fail("ERROR");

  const { data, error } = await supabase.rpc("link_google_user");
  const result = error ? ({ ok: false, error: "ERROR" } as const) : readLinkResult(data);
  if (!result.ok) {
    await supabase.auth.signOut();
    return fail(result.error);
  }
  return NextResponse.redirect(new URL("/auth/listo", url.origin));
}
