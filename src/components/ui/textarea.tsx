import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, ...props },
  ref,
) {
  const textareaId = id ?? props.name;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && <label className="text-sm font-bold text-ink" htmlFor={textareaId}>{label}</label>}
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : undefined}
        className={cn("min-h-28 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent", error && "border-danger focus:border-danger focus:ring-danger", className)}
        {...props}
      />
      {error && <p id={`${textareaId}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  );
});
