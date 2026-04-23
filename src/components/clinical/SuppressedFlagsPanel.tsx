import { useState } from "react";
import { ChevronDown, EyeOff } from "lucide-react";

interface Suppressed { label: string; reason: string; }

interface Props {
  /** Explicitly suppressed flags from the model. */
  suppressed?: Suppressed[];
  /** Items from the red-flag checklist marked not_applicable, used as a fallback. */
  notApplicableItems?: { item: string; evidence: string }[];
}

export function SuppressedFlagsPanel({ suppressed, notApplicableItems }: Props) {
  const [open, setOpen] = useState(false);

  const merged: Suppressed[] = [
    ...(suppressed ?? []),
    ...(notApplicableItems ?? []).map((it) => ({
      label: it.item,
      reason: it.evidence || "Marked not applicable to this patient by the audit engine.",
    })),
  ];

  if (merged.length === 0) return null;

  return (
    <div className="mt-4 rounded-md border border-dashed border-border bg-surface-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted/40"
      >
        <div className="flex items-center gap-2">
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <div className="text-xs font-medium">Why other red flags were not shown</div>
            <div className="text-[11px] text-muted-foreground">
              {merged.length} screen{merged.length === 1 ? "" : "s"} considered and suppressed as not applicable to this case.
            </div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="space-y-2 border-t border-border px-4 py-3">
          {merged.map((s, i) => (
            <li key={i} className="rounded-sm border border-border bg-background p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium">{s.label}</div>
                <span className="rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                  Suppressed
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
