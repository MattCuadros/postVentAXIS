import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-accent-soft text-accent",
};

const ICONS: Record<Tone, typeof InfoIcon> = {
  success: CheckIcon,
  warning: AlertIcon,
  danger: AlertIcon,
  info: InfoIcon,
};

interface NoticeProps {
  tone?: Tone;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** Aviso en línea. Errores y advertencias se anuncian como alerta; el resto, como estado. */
export function Notice({ tone = "info", children, onDismiss, className }: NoticeProps) {
  const Icon = ICONS[tone];

  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-md p-4 text-sm", TONES[tone], className)}
    >
      <Icon className="mt-px h-[18px] w-[18px] shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Cerrar aviso"
          className="-m-1 shrink-0 rounded-sm p-1 transition-colors hover:bg-ink/5"
          onClick={onDismiss}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
