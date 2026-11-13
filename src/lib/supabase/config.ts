/**
 * Proyecto Supabase que respalda el ingreso con Google (Auth + directorio de usuarios).
 * La URL y la clave publicable son públicas por diseño (viajan en el navegador); se pueden
 * reemplazar con NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Las claves
 * secretas (service role) nunca van aquí ni en variables NEXT_PUBLIC_.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sjidudkwvoehmzlexldi.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_XVLAzzv0U2Rxs9NALD_fCQ_iMToaXsm";

/** El ingreso con Google se puede apagar con NEXT_PUBLIC_GOOGLE_LOGIN=false. */
export function isGoogleLoginConfigured(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_LOGIN !== "false";
}
