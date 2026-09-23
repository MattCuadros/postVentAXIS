import Link from "next/link";
import type { ReactNode } from "react";
import { RoleHeader } from "@/components/session/role-header";

const navigation = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/requerimientos", label: "Requerimientos" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/obras", label: "Obras" },
  { href: "/admin/equipos", label: "Equipos" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <RoleHeader />
      <div className="flex flex-1 flex-col md:flex-row">
        <nav aria-label="Navegación de administración" className="shrink-0 border-b border-line bg-surface-secondary md:w-60 md:border-b-0 md:border-r">
          <div className="flex gap-1 overflow-x-auto px-4 py-3 md:sticky md:top-0 md:flex-col md:gap-2 md:px-4 md:py-6">
            {navigation.map(({ href, label }) => (
              <Link key={href} href={href} className="shrink-0 rounded-md px-3 py-2 text-sm font-bold text-ink-secondary transition-colors hover:bg-surface hover:text-accent focus-visible:ring-2 focus-visible:ring-accent">
                {label}
              </Link>
            ))}
          </div>
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
