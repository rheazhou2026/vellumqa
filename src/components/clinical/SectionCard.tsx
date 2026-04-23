import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function SectionCard({
  icon: Icon,
  title,
  eyebrow,
  description,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "paper-card p-6 animate-fade-up",
        className,
      )}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          {eyebrow && (
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </div>
          )}
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
            {Icon && <Icon className="h-5 w-5 text-accent" />}
            {title}
          </h2>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </header>
      <div className="ink-rule mb-5" />
      {children}
    </section>
  );
}