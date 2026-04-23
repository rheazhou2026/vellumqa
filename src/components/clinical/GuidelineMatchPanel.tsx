import { ALIGNMENT_LABELS } from "@/lib/clinical-types";

interface GuidelineRef {
  guideline_id: string;
  name: string;
  organization: string;
  alignment: "aligned" | "partial" | "missing" | "not_applicable";
  notes: string;
  aligned_elements?: string[];
  missing_elements?: string[];
}

const ALIGN_CLS: Record<string, string> = {
  aligned: "border-safe/40 bg-safe-soft/30 text-safe",
  partial: "border-important/40 bg-important-soft/30 text-important",
  missing: "border-critical/40 bg-critical-soft/30 text-critical",
  not_applicable: "border-border bg-surface-muted text-muted-foreground",
};

export function GuidelineMatchPanel({ refs }: { refs: GuidelineRef[] }) {
  if (!refs || refs.length === 0) {
    return <div className="text-sm text-muted-foreground">No guidelines from your library matched this presentation.</div>;
  }
  return (
    <div className="space-y-4">
      {refs.map((g, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">{g.name}</div>
              <div className="text-xs text-muted-foreground">{g.organization}</div>
            </div>
            <span className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-widest ${ALIGN_CLS[g.alignment] ?? ALIGN_CLS.not_applicable}`}>
              {ALIGNMENT_LABELS[g.alignment as keyof typeof ALIGNMENT_LABELS] ?? g.alignment}
            </span>
          </div>
          {g.notes && <p className="mt-2 text-sm text-muted-foreground">{g.notes}</p>}
          {(g.aligned_elements?.length || g.missing_elements?.length) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-widest text-safe">Aligned elements</div>
                {g.aligned_elements?.length ? (
                  <ul className="space-y-1 text-sm">
                    {g.aligned_elements.map((x, j) => (
                      <li key={j} className="flex gap-1.5"><span className="text-safe">✓</span>{x}</li>
                    ))}
                  </ul>
                ) : <div className="text-xs text-muted-foreground">None recorded.</div>}
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-widest text-critical">Missing elements</div>
                {g.missing_elements?.length ? (
                  <ul className="space-y-1 text-sm">
                    {g.missing_elements.map((x, j) => (
                      <li key={j} className="flex gap-1.5"><span className="text-critical">✗</span>{x}</li>
                    ))}
                  </ul>
                ) : <div className="text-xs text-muted-foreground">None recorded.</div>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
