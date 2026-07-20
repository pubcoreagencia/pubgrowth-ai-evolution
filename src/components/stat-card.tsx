import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  icon?: ReactNode;
  accent?: "primary" | "success" | "warning" | "destructive" | "muted";
  className?: string;
  children?: ReactNode;
}

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "text-primary",
  success: "text-[color:var(--color-success)]",
  warning: "text-[color:var(--color-warning)]",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

export function StatCard({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  icon,
  accent = "primary",
  className,
  children,
}: StatCardProps) {
  const up = typeof delta === "number" && delta >= 0;
  return (
    <div
      className={cn(
        "surface-card group relative overflow-hidden p-5 transition-colors hover:border-primary/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {icon && (
          <div
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md bg-accent/40",
              accentMap[accent],
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              up
                ? "bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
            {deltaLabel && <span className="ml-0.5 opacity-70">{deltaLabel}</span>}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
