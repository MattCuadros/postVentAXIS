import type { ReactNode } from "react";
import { AxisBand } from "@/components/brand/axis-band";
import { RoleHeader } from "@/components/session/role-header";
import { SideNav } from "@/components/session/side-nav";

const NAVIGATION = [
  { href: "/encargado", label: "Requerimientos" },
  { href: "/encargado/calendario", label: "Calendario" },
  { href: "/encargado/equipos", label: "Equipos de trabajo" },
];

export default function EncargadoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <RoleHeader />
      <div className="flex flex-1 flex-col md:flex-row">
        <SideNav items={NAVIGATION} label="Navegación del encargado" rootHref="/encargado" />
        <main className="flex min-w-0 flex-1 flex-col px-4 pt-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <AxisBand />
    </div>
  );
}
