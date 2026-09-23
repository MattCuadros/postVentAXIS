"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={title ? titleId : undefined}
      className={cn("m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-surface p-0 text-ink shadow-raised")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="relative p-6">
        <button aria-label="Cerrar diálogo" className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-secondary hover:text-ink focus-visible:ring-2 focus-visible:ring-accent" type="button" onClick={onClose}>
          <span aria-hidden="true" className="text-2xl leading-none">×</span>
        </button>
        {title && <h2 id={titleId} className="pr-10 text-xl">{title}</h2>}
        <div className={cn(title && "mt-5")}>{children}</div>
      </div>
    </dialog>
  );
}
