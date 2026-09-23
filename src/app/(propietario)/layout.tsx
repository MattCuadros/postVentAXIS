import type { ReactNode } from "react";
import { AxisBand } from "@/components/brand/axis-band";
import { RoleHeader } from "@/components/session/role-header";

export default function PropietarioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <RoleHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-6 sm:px-6">{children}</main>
      <AxisBand />
    </div>
  );
}
