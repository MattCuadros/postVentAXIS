import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && <label className="text-sm font-bold text-ink" htmlFor={inputId}>{label}</label>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn("h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent", error && "border-danger focus:border-danger focus:ring-danger", className)}
        {...props}
      />
      {error && <p id={`${inputId}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  );
});
