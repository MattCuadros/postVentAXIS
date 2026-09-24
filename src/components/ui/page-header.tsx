import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Botones a la derecha del título. */
  actions?: ReactNode;
  /** Enlace de vuelta sobre el título. */
  back?: { href: string; label: string };
  /** Contenido junto al título (ej. estado del ticket). */
  aside?: ReactNode;
  className?: string;
}

/** Encabezado común de página: vuelta opcional, título, bajada y acciones. */
export function PageHeader({ title, subtitle, actions, back, aside, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-[75ch]">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline">
            <ChevronLeftIcon className="h-4 w-4" />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl">{title}</h1>
          {aside}
        </div>
        {subtitle && <div className="mt-1 text-sm text-ink-secondary">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-end gap-3">{actions}</div>}
    </header>
  );
}
