"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AxisBand } from "@/components/brand/axis-band";
import { AxisLogo } from "@/components/brand/axis-logo";
import { Tagline } from "@/components/brand/tagline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/data/session-context";
import { useDataContext } from "@/data/store-context";
import type { Role } from "@/types/domain";

const ROLE_DETAILS: Record<Role, { label: string; home: string }> = {
  PROPIETARIO: { label: "Propietario", home: "/propietario" },
  ENCARGADO: { label: "Encargado", home: "/encargado" },
  ADMIN_OBRA: { label: "Administrador de obra", home: "/admin-obra" },
  ADMIN: { label: "Administrador", home: "/admin" },
};

const ROLES: Role[] = ["PROPIETARIO", "ENCARGADO", "ADMIN_OBRA", "ADMIN"];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useSession();
  const { state } = useDataContext();
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase("es");
  const users = state.users.filter(
    (user) => user.active && (!term || `${user.name} ${user.email}`.toLocaleLowerCase("es").includes(term)),
  );

  function handleUserSelect(userId: string, role: Role) {
    setUser(userId);
    router.replace(ROLE_DETAILS[role].home);
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
                    {ROLE_DETAILS[role].label}
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

        <Tagline className="mt-10" />
      </section>
      <AxisBand />
    </main>
  );
}
