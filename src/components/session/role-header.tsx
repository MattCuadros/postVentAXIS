"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AxisLogo } from "@/components/brand/axis-logo";
import { useSession } from "@/data/session-context";
import { useDataContext } from "@/data/store-context";
import { unitLabel } from "@/lib/format";
import type { Role, User } from "@/types/domain";

const ROLE_HOME: Record<Role, string> = {
  PROPIETARIO: "/propietario",
  ENCARGADO: "/encargado",
  ADMIN: "/admin",
  ADMIN_OBRA: "/admin-obra",
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Encabezado común a los tres roles: logo, nombre de la app y menú de usuario. */
export function RoleHeader() {
  const router = useRouter();
  const { user, setUser } = useSession();
  const { state, resetData, storageError } = useDataContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Publica la altura real del encabezado fijo para que el menú lateral quede justo debajo.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty("--role-header-height", `${Math.ceil(entry.borderBoxSize[0]?.blockSize ?? header.offsetHeight)}px`);
    });
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--role-header-height");
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  // Sesión con un usuario que ya no existe en los datos locales o que fue desactivado: fuera.
  useEffect(() => {
    if (user === null) {
      setUser(null);
      router.replace("/login");
    }
  }, [user, setUser, router]);

  function handleReset() {
    const confirmed = window.confirm(
      "Se borrarán todos los cambios guardados en este navegador (usuarios, obras, unidades, equipos y requerimientos) y se cargarán los datos de ejemplo. ¿Continuar?",
    );
    if (!confirmed) return;
    setMenuOpen(false);
    resetData();
    setUser(null);
    router.replace("/login");
  }

  function subtitle(current: User): string {
    if (current.role === "ADMIN") return "Superadministrador · Todas las zonas";
    if (current.role === "ADMIN_OBRA") {
      const names = state.projects.filter((project) => current.projectIds.includes(project.id)).map((project) => project.name);
      return ["Administrador de obra", ...names].join(" · ");
    }
    if (current.role === "ENCARGADO") {
      const names = state.zones.filter((zone) => current.zoneIds.includes(zone.id)).map((zone) => zone.name);
      return ["Encargado", ...names].join(" · ");
    }
    return state.units.filter((unit) => unit.ownerId === current.id).map(unitLabel).join(" · ");
  }

  function handleLogout() {
    setMenuOpen(false);
    setUser(null);
    router.replace("/login");
  }

  function handleUserChange(userId: string) {
    const nextUser = state.users.find((item) => item.id === userId && item.active);
    if (nextUser === undefined) return;
    setMenuOpen(false);
    setUser(nextUser.id);
    router.replace(ROLE_HOME[nextUser.role]);
  }

  return (
    <header className="translucent-surface sticky top-0 z-30 bg-surface/80 shadow-[0_5px_16px_rgba(0,31,92,0.06)] backdrop-blur-md backdrop-saturate-150" ref={headerRef}>
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <AxisLogo width={120} priority />
          <span className="hidden text-lg font-bold text-accent sm:inline">PostventAXIS</span>
        </div>

        {user && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-3 rounded-md p-1 text-right transition duration-150 ease-axis-out hover:bg-surface-secondary active:scale-[0.98]"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="hidden flex-col sm:flex">
                <span className="text-sm font-bold text-ink">{user.name}</span>
                <span className="text-xs text-ink-secondary">{subtitle(user)}</span>
              </span>
              <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                {initials(user.name)}
              </span>
              <span className="sr-only">Menú de {user.name}</span>
            </button>

            {menuOpen && (
              <div role="menu" className="absolute right-0 top-full z-20 mt-2 w-72 origin-top-right rounded-lg border border-line-soft bg-surface p-4 shadow-raised animate-menu-in">
                <div className="sm:hidden">
                  <p className="text-sm font-bold text-ink">{user.name}</p>
                  <p className="text-xs text-ink-secondary">{subtitle(user)}</p>
                  <hr className="my-3 border-line-soft" />
                </div>
                {process.env.NODE_ENV === "development" && (
                  <label className="mb-3 flex flex-col gap-1 text-xs font-bold text-ink-secondary" htmlFor="development-user-switcher">
                    Cambiar usuario (desarrollo)
                    <select
                      id="development-user-switcher"
                      className="h-10 rounded-md border border-line bg-surface px-3 text-sm font-normal text-ink"
                      value={user.id}
                      onChange={(event) => handleUserChange(event.target.value)}
                    >
                      {state.users.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                )}
                {(user.role === "ADMIN" || process.env.NODE_ENV === "development") && (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-danger/5"
                    onClick={handleReset}
                  >
                    Restablecer datos de ejemplo
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-md px-3 py-2 text-left text-sm font-bold text-accent hover:bg-accent-soft"
                  onClick={handleLogout}
                >
                  Salir
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {storageError && (
        <p role="alert" className="border-t border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning sm:px-6 lg:px-8">
          {storageError}
        </p>
      )}
    </header>
  );
}
