import type { ReactNode } from "react";
import { AxisBand } from "@/components/brand/axis-band";
import { RoleHeader } from "@/components/session/role-header";

/** Administrador de obra: una sola vista de indicadores, de solo lectura. */
export default function AdminObraLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <RoleHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pt-6 sm:px-6 lg:px-8">{children}</main>
      <AxisBand />
    </div>
  );
}
