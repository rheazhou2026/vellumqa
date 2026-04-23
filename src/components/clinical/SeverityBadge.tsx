import { cn } from "@/lib/utils";
import { AlertOctagon, AlertTriangle, Info, CircleDot } from "lucide-react";
import type { Severity } from "@/lib/clinical-types";

const config: Record<
  Severity,
  { label: string; cls: string; Icon: typeof AlertOctagon }
> = {
  critical: {
    label: "Critical",
    cls: "bg-critical-soft text-critical border-critical/30",
    Icon: AlertOctagon,
  },
  important: {
    label: "Important",
    cls: "bg-important-soft text-important border-important/30",
    Icon: AlertTriangle,
  },
  minor: {
    label: "Minor",
    cls: "bg-muted text-muted-foreground border-border",
    Icon: CircleDot,
  },
  info: {
    label: "Info",
    cls: "bg-info-soft text-info border-info/20",
    Icon: Info,
  },
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const c = config[severity] ?? config.info;
  const Icon = c.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tracking-wide uppercase",
        c.cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}