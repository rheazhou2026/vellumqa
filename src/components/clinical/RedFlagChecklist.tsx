import { Check, X, Minus } from "lucide-react";

type Status = "present" | "missing" | "not_applicable";
interface Item { item: string; status: Status; evidence: string; }

const STATUS_CONFIG: Record<Status, { label: string; icon: typeof Check; cls: string; ring: string }> = {
  present: { label: "Screened", icon: Check, cls: "text-safe", ring: "border-safe/40 bg-safe-soft/40" },
  missing: { label: "Missing", icon: X, cls: "text-critical", ring: "border-critical/40 bg-critical-soft/40" },
  not_applicable: { label: "N/A", icon: Minus, cls: "text-muted-foreground", ring: "border-border bg-surface-muted/40" },
};

export function RedFlagChecklist({ scenario, items }: { scenario: string; items: Item[] }) {
  if (!items || items.length === 0) return null;
  const screened = items.filter(i => i.status === "present").length;
  const missing = items.filter(i => i.status === "missing").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-md border border-border bg-surface-muted px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">Scenario: </span>
          <span className="font-medium">{scenario}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="text-safe font-medium">{screened} screened</span>
          <span className="mx-2">·</span>
          <span className="text-critical font-medium">{missing} missing</span>
          <span className="mx-2">·</span>
          <span>{items.length} total</span>
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => {
          const cfg = STATUS_CONFIG[it.status];
          const Icon = cfg.icon;
          return (
            <li key={i} className={`flex items-start gap-3 rounded-md border ${cfg.ring} p-3`}>
              <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-background ${cfg.cls}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{it.item}</div>
                  <span className={`text-[10px] uppercase tracking-widest ${cfg.cls}`}>{cfg.label}</span>
                </div>
                {it.evidence && (
                  <p className="mt-1 text-xs text-muted-foreground">{it.evidence}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
