"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AxisBand } from "@/components/brand/axis-band";
import { AxisLogo } from "@/components/brand/axis-logo";
import { Tagline } from "@/components/brand/tagline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { useSession } from "@/data/session-context";
import { useDataContext } from "@/data/store-context";
import { isTestMode } from "@/lib/app-mode";
import { ROLE_HOME } from "@/lib/role-home";
import { ROLE_LABEL } from "@/lib/user-import";
import type { Role } from "@/types/domain";

const ROLES: Role[] = ["PROPIETARIO", "ENCARGADO", "ADMIN_OBRA", "ADMIN"];

/** Pantalla de pruebas: entrar como cualquier usuario de ejemplo. Solo existe en modo pruebas. */
export default function PruebasPage() {
  const router = useRouter();
  const { setUser } = useSession();
  const { state } = useDataContext();
  const [search, setSearch] = useState("");
  const testMode = isTestMode();
  const term = search.trim().toLocaleLowerCase("es");
  const users = state.users.filter(
    (user) => user.active && (!term || `${user.name} ${user.email}`.toLocaleLowerCase("es").includes(term)),
  );

  // Con el modo pruebas apagado esta pantalla no existe (el proxy también lo impide).
  useEffect(() => {
    if (!testMode) router.replace("/login");
  }, [testMode, router]);

  if (!testMode) return null;

  function handleUserSelect(userId: string, role: Role) {
    setUser(userId);
    router.replace(ROLE_HOME[role]);
  }

  return (
    <main className="flex min-h-full flex-1 flex-col bg-surface">
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10 sm:justify-center">
        <div className="mb-10 flex flex-col items-center gap-6 text-center">
          <AxisLogo width={180} priority />
          <div>
            <h1 className="text-2xl font-bold text-accent">PostventAXIS</h1>
            <p className="mt-2 text-sm text-ink-secondary">Selecciona tu usuario para continuar.</p>
          </div>
        </div>

        <Notice tone="info" className="mb-4">Ambiente de pruebas: elige un usuario para ver la app desde su rol.</Notice>

        <Card className="border border-line-soft p-5 sm:p-6">
          <h2 className="text-lg font-bold text-accent">Ingresar como</h2>
          <div className="mt-4">
            <Input label="Buscar usuario" name="login-search" type="search" placeholder="Nombre o correo" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="mt-5 space-y-6">
            {users.length === 0 && <p className="text-sm text-ink-secondary">Ningún usuario activo coincide con la búsqueda.</p>}
            {ROLES.map((role) => {
              const roleUsers = users.filter((user) => user.role === role);
              if (roleUsers.length === 0) return null;
              return (
                <section key={role} aria-labelledby={`role-${role}`}>
                  <h3 id={`role-${role}`} className="text-sm font-bold text-ink-secondary">
                    {ROLE_LABEL[role]}
                  </h3>
                  <div className="mt-2 space-y-2">
                    {roleUsers.map((user) => (
                      <Button key={user.id} variant="secondary" fullWidth className="justify-start" onClick={() => handleUserSelect(user.id, user.role)}>
                        {user.name}
                      </Button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </Card>

        <Link href="/login" className="mt-6 self-start text-sm font-bold text-accent hover:underline">← Volver al ingreso</Link>

        <Tagline className="mt-10" />
      </section>
      <AxisBand />
    </main>
  );
}
