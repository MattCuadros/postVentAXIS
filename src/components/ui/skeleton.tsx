import { cn } from "@/lib/cn";

/** Bloque de carga con la forma aproximada del contenido que viene. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-pulse rounded-md bg-line-soft/70", className)} />;
}

interface ContentSkeletonProps {
  label?: string;
  lines?: number;
  className?: string;
}

/** Carga genérica de una lista o detalle: un título y algunas filas. */
export function ContentSkeleton({ label = "Cargando contenido…", lines = 3, className }: ContentSkeletonProps) {
  return (
    <div role="status" aria-label={label} className={cn("mt-6 space-y-3", className)}>
      <Skeleton className="h-5 w-2/5" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn("h-16 w-full", index === lines - 1 && "w-4/5")} />
      ))}
    </div>
  );
}

/** Carga de una tabla: encabezado y filas del alto real de la tabla. */
export function TableSkeleton({ label = "Cargando…", rows = 5, className }: { label?: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("rounded-lg border border-line-soft bg-surface px-6 py-4 shadow-card", className)}>
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-5 space-y-5">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}
