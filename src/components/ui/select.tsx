import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, id, children, ...props },
  ref,
) {
  const selectId = id ?? props.name;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && <label className="text-sm font-bold text-ink" htmlFor={selectId}>{label}</label>}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={cn("h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent", error && "border-danger focus:border-danger focus:ring-danger", className)}
        {...props}
      >
        {children}
      </select>
      {error && <p id={`${selectId}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  );
});
