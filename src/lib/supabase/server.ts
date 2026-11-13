import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export interface CookieToSet {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

/** Cliente de servidor sobre un almacén de cookies cualquiera (Route Handler o proxy). */
export function supabaseServer(getAll: () => { name: string; value: string }[], setAll: (cookies: CookieToSet[]) => void): SupabaseClient {
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll, setAll } });
}
