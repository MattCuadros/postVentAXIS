import { WORKSPACE_DOMAIN } from "@/lib/google-auth";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { isGoogleLoginConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import type { User } from "@/types/domain";

/** ¿Está habilitado Google como proveedor en Supabase Auth? (dato público del proyecto). */
export async function isGoogleLoginAvailable(): Promise<boolean> {
  if (!isGoogleLoginConfigured()) return false;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

/** Lleva a la pantalla de Google; al volver, `/auth/callback` valida la cuenta contra el directorio. */
export async function signInWithGoogle(): Promise<boolean> {
  const { error } = await supabaseBrowser().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      // `hd` solo preselecciona el dominio en Google; la restricción real está en la base de datos.
      queryParams: { hd: WORKSPACE_DOMAIN, prompt: "select_account" },
    },
  });
  return !error;
}

/** Cierra la sesión de Supabase de este navegador, si la hay. Nunca lanza. */
export async function signOutGoogle(): Promise<void> {
  if (!isGoogleLoginConfigured() || !hasGoogleSession()) return;
  try {
    await supabaseBrowser().auth.signOut({ scope: "local" });
  } catch {
    // Sin red: las cookies locales igual se descartan al volver a ingresar.
  }
}

/** Hay cookies de sesión de Supabase en este navegador (alguien ingresó con Google). */
export function hasGoogleSession(): boolean {
  return typeof document !== "undefined" && /(^|; )sb-[^=]*-auth-token/.test(document.cookie);
}

export type DirectorySync = { ok: true } | { ok: false; reason: "CORREO_DUPLICADO" | "SIN_PERMISO" | "ERROR" };

/**
 * Deja a un usuario en el directorio que usa el ingreso con Google. Solo aplica cuando quien
 * guarda ingresó con Google (la base de datos exige que sea superadministrador); con la sesión
 * de pruebas no hay nada que sincronizar.
 */
export async function syncUserToDirectory(user: User): Promise<DirectorySync> {
  if (!isGoogleLoginConfigured() || !hasGoogleSession()) return { ok: true };
  try {
    const { data, error } = await supabaseBrowser().rpc("admin_upsert_user", {
      p_user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, active: user.active, zone_ids: user.zoneIds, project_ids: user.projectIds },
    });
    if (error) return { ok: false, reason: "ERROR" };
    const status = (data as { status?: string } | null)?.status;
    if (status === "OK") return { ok: true };
    return { ok: false, reason: status === "CORREO_DUPLICADO" || status === "SIN_PERMISO" ? status : "ERROR" };
  } catch {
    return { ok: false, reason: "ERROR" };
  }
}
