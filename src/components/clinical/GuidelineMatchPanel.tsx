import { ALIGNMENT_LABELS } from "@/lib/clinical-types";

type AlignedElement = string | { element: string; note_evidence?: string };
type MissingElement = string | { element: string; guideline_evidence?: string };

interface GuidelineRef {
  guideline_id: string;
  name: string;
  organization: string;
  alignment: "aligned" | "partial" | "missing" | "not_applicable";
  notes: string;
  aligned_elements?: AlignedElement[];
  missing_elements?: MissingElement[];
}

const ALIGN_CLS: Record<string, string> = {
  aligned: "border-safe/40 bg-safe-soft/30 text-safe",
  partial: "border-important/40 bg-important-soft/30 text-important",
  missing: "border-critical/40 bg-critical-soft/30 text-critical",
  not_applicable: "border-border bg-surface-muted text-muted-foreground",
};

function unpackAligned(x: AlignedElement) {
  if (typeof x === "string") return { element: x, evidence: "" };
  return { element: x.element, evidence: x.note_evidence ?? "" };
}
function unpackMissing(x: MissingElement) {
  if (typeof x === "string") return { element: x, evidence: "" };
  return { element: x.element, evidence: x.guideline_evidence ?? "" };
}

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
                  <ul className="space-y-2 text-sm">
                    {g.aligned_elements.map((x, j) => {
                      const { element, evidence } = unpackAligned(x);
                      return (
                        <li key={j} className="rounded-sm border border-safe/20 bg-safe-soft/20 p-2">
                          <div className="flex gap-1.5"><span className="text-safe">✓</span><span className="font-medium">{element}</span></div>
                          {evidence && (
                            <div className="mt-1 border-l-2 border-safe/40 pl-2 text-xs italic text-muted-foreground">
                              <span className="not-italic font-medium text-foreground/70">From note: </span>"{evidence}"
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : <div className="text-xs text-muted-foreground">None recorded.</div>}
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-widest text-critical">Missing elements</div>
                {g.missing_elements?.length ? (
                  <ul className="space-y-2 text-sm">
                    {g.missing_elements.map((x, j) => {
                      const { element, evidence } = unpackMissing(x);
                      return (
                        <li key={j} className="rounded-sm border border-critical/20 bg-critical-soft/20 p-2">
                          <div className="flex gap-1.5"><span className="text-critical">✗</span><span className="font-medium">{element}</span></div>
                          {evidence && (
                            <div className="mt-1 border-l-2 border-critical/40 pl-2 text-xs italic text-muted-foreground">
                              <span className="not-italic font-medium text-foreground/70">Guideline expects: </span>"{evidence}"
                            </div>
                          )}
                        </li>
                      );
                    })}
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
