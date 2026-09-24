import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "white" | "gray";
}

export function Card({ tone = "white", className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-lg border border-line-soft/80 p-6 shadow-card", tone === "white" ? "bg-surface" : "bg-surface-secondary", className)}
      {...props}
    />
  );
}
