"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AxisLogo } from "@/components/brand/axis-logo";
import { useSession } from "@/data/session-context";
import { useDataContext } from "@/data/store-context";
import { readProfile } from "@/lib/google-auth";
import { ROLE_HOME } from "@/lib/role-home";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Último paso del ingreso con Google: trae el perfil del directorio, lo deja en los datos de este
 * navegador (la app aún trabaja con datos locales) y abre la sesión en la sección del rol.
 */
export default function AuthReadyPage() {
  const router = useRouter();
  const { state, dispatch } = useDataContext();
  const { setUser } = useSession();
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.rpc("session_profile");
      const profile = error ? null : readProfile(data);
      if (cancelled) return;
      if (!profile || !profile.active) {
        await supabase.auth.signOut();
        router.replace("/login?error=NO_REGISTRADO");
        return;
      }
      dispatch({ type: "UPSERT_USER", user: profile });
      setProfileId(profile.id);
    })().catch(() => router.replace("/login?error=ERROR"));
    return () => {
      cancelled = true;
    };
  }, [dispatch, router]);

  // La sesión se abre cuando el perfil ya está en los datos locales (setUser lo busca ahí).
  const user = profileId ? state.users.find((item) => item.id === profileId && item.active) : undefined;
  useEffect(() => {
    if (!user) return;
    setUser(user.id);
    router.replace(ROLE_HOME[user.role]);
  }, [user, setUser, router]);

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 bg-surface px-6 py-10 text-center">
      <AxisLogo width={160} priority />
      <p role="status" className="text-sm text-ink-secondary">Ingresando a PostventAXIS…</p>
    </main>
  );
}
