import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border px-6 py-6 flex items-end justify-between gap-6">
      <div>
        {eyebrow && (
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-tertiary mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-4xl tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}