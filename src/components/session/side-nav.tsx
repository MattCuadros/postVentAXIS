"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Navegación de sección: pestañas horizontales en móvil, barra lateral desde `md`.
 * Un ítem queda activo si la ruta actual es la suya o una subruta (salvo la raíz del rol, que solo
 * se activa en sí misma o en el detalle de tickets).
 */
export function SideNav({ items, label, rootHref }: { items: NavItem[]; label: string; rootHref: string }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === rootHref) {
      return pathname === rootHref || pathname.startsWith(`${rootHref}/tickets`);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav aria-label={label} className="shrink-0 border-b border-line-soft bg-surface md:w-60 md:border-b-0 md:border-r">
      <div className="flex gap-1 overflow-x-auto px-4 py-3 md:sticky md:top-[var(--role-header-height,98px)] md:max-h-[calc(100dvh-var(--role-header-height,98px))] md:overflow-y-auto md:flex-col md:gap-2 md:py-6">
        {items.map(({ href, label: itemLabel }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md px-4 py-2.5 text-sm transition-colors",
                active ? "bg-accent-soft font-bold text-accent" : "text-ink-secondary hover:bg-surface-secondary hover:text-accent",
              )}
            >
              {itemLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
