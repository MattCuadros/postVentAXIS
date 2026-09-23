import type { ReactNode } from "react";
import { RoleHeader } from "@/components/session/role-header";

export default function EncargadoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <RoleHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
