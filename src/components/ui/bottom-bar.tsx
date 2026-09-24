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
          "translucent-surface sticky bottom-0 -mx-4 flex gap-3 border-t border-white/70 bg-surface/80 px-4 py-4 shadow-[0_-6px_18px_rgba(0,31,92,0.06)] backdrop-blur-md backdrop-saturate-150 sm:-mx-6 sm:px-6",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
