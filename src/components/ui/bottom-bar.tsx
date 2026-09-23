import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Barra de acciones fija al pie en vistas móviles. Debe ir dentro del `<main>` (flex-col) del layout:
 * el espaciador la empuja al fondo cuando el contenido es corto.
 */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <>
      <div aria-hidden className="min-h-8 flex-1" />
      <div
        className={cn(
          "sticky bottom-0 -mx-4 flex gap-3 border-t border-line-soft bg-surface px-4 py-4 sm:-mx-6 sm:px-6",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
