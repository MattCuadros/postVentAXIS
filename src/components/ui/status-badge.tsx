import type { TicketStatus } from "@/types/domain";
import { STATUS_LABEL, STATUS_TONE, type StatusTone } from "@/lib/ticket-status";
import { cn } from "@/lib/cn";

const TONES: Record<StatusTone, string> = {
  neutral: "bg-surface-secondary text-ink-secondary",
  active: "bg-accent-soft text-accent",
  attention: "bg-brand-orange-soft text-brand-orange-ink",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
};

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-3 py-1 text-xs font-semibold",
        TONES[STATUS_TONE[status]],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
