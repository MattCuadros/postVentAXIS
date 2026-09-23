"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AxisLogo } from "@/components/brand/axis-logo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/data/session-context";
import { users } from "@/mocks/data";
import type { Role } from "@/types/domain";

const ROLE_HOME: Record<Role, string> = {
  PROPIETARIO: "/propietario",
  ENCARGADO: "/encargado",
  ADMIN: "/admin",
};

export function RoleHeader({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useSession();

  function handleLogout() {
    setUser(null);
    router.replace("/login");
  }

  function handleUserChange(userId: string) {
    const nextUser = users.find((item) => item.id === userId);
    if (nextUser === undefined) return;
    setUser(nextUser.id);
    router.replace(ROLE_HOME[nextUser.role]);
  }

  return (
    <header className="border-b border-line-soft bg-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <AxisLogo width={120} />
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-ink">{user?.name ?? ""}</span>
          <Button variant="secondary" onClick={handleLogout}>Cambiar de usuario</Button>
        </div>
      </div>
      {children && <div className="mx-auto w-full max-w-7xl px-4 pb-3 sm:px-6">{children}</div>}
      {process.env.NODE_ENV === "development" && (
        <div className="mx-auto w-full max-w-7xl px-4 pb-3 sm:px-6">
          <label className="flex max-w-sm flex-col gap-1 text-xs font-bold text-ink-secondary" htmlFor="development-user-switcher">
            Cambiar usuario (desarrollo)
            <select id="development-user-switcher" className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-normal text-ink" value={user?.id ?? ""} onChange={(event) => handleUserChange(event.target.value)}>
              <option value="" disabled>Selecciona un usuario</option>
              {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      )}
    </header>
  );
}
