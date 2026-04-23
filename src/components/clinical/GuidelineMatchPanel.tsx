import { useState } from "react";
import { ALIGNMENT_LABELS } from "@/lib/clinical-types";
import { Columns2, List, ArrowRight } from "lucide-react";

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
  const [view, setView] = useState<"list" | "diff">("diff");

  if (!refs || refs.length === 0) {
    return <div className="text-sm text-muted-foreground">No guidelines from your library matched this presentation.</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-md border border-border bg-background p-0.5">
          <button
            type="button"
            onClick={() => setView("diff")}
            className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs transition-colors ${view === "diff" ? "bg-surface-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Columns2 className="h-3.5 w-3.5" />
            Diff view
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs transition-colors ${view === "list" ? "bg-surface-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="h-3.5 w-3.5" />
            List view
          </button>
        </div>
      </div>

      {refs.map((g, i) => {
        const aligned = (g.aligned_elements ?? []).map(unpackAligned);
        const missing = (g.missing_elements ?? []).map(unpackMissing);
        return (
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

            {(aligned.length > 0 || missing.length > 0) && (
              view === "diff" ? (
                <DiffView aligned={aligned} missing={missing} />
              ) : (
                <ListView aligned={aligned} missing={missing} />
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

function DiffView({
  aligned, missing,
}: {
  aligned: { element: string; evidence: string }[];
  missing: { element: string; evidence: string }[];
}) {
  const rows = Math.max(aligned.length, missing.length);
  if (rows === 0) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-border">
      <div className="grid grid-cols-2 border-b border-border bg-surface-muted/40 text-[10px] uppercase tracking-widest">
        <div className="border-r border-border px-3 py-1.5 text-safe">Aligned · note evidence</div>
        <div className="px-3 py-1.5 text-critical">Missing · guideline expects</div>
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, idx) => {
          const a = aligned[idx];
          const m = missing[idx];
          return (
            <div key={idx} className="grid grid-cols-2">
              <div className={`border-r border-border p-3 ${a ? "bg-safe-soft/15" : "bg-background"}`}>
                {a ? (
                  <>
                    <div className="flex gap-1.5 text-sm"><span className="text-safe">+</span><span className="font-medium">{a.element}</span></div>
                    {a.evidence ? (
                      <div className="mt-1.5 border-l-2 border-safe/50 pl-2 text-xs italic text-foreground/80">
                        "{a.evidence}"
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-muted-foreground">No quote captured.</div>
                    )}
                  </>
                ) : (
                  <div className="text-[11px] text-muted-foreground">—</div>
                )}
              </div>
              <div className={`p-3 ${m ? "bg-critical-soft/15" : "bg-background"}`}>
                {m ? (
                  <>
                    <div className="flex gap-1.5 text-sm"><span className="text-critical">−</span><span className="font-medium">{m.element}</span></div>
                    {m.evidence ? (
                      <div className="mt-1.5 flex items-start gap-1 border-l-2 border-critical/50 pl-2 text-xs italic text-foreground/80">
                        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 not-italic text-critical" />
                        <span>expected: "{m.evidence}"</span>
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-muted-foreground">No expected text recorded.</div>
                    )}
                  </>
                ) : (
                  <div className="text-[11px] text-muted-foreground">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({
  aligned, missing,
}: {
  aligned: { element: string; evidence: string }[];
  missing: { element: string; evidence: string }[];
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-widest text-safe">Aligned elements</div>
        {aligned.length ? (
          <ul className="space-y-2 text-sm">
            {aligned.map((x, j) => (
              <li key={j} className="rounded-sm border border-safe/20 bg-safe-soft/20 p-2">
                <div className="flex gap-1.5"><span className="text-safe">✓</span><span className="font-medium">{x.element}</span></div>
                {x.evidence && (
                  <div className="mt-1 border-l-2 border-safe/40 pl-2 text-xs italic text-muted-foreground">
                    <span className="not-italic font-medium text-foreground/70">From note: </span>"{x.evidence}"
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <div className="text-xs text-muted-foreground">None recorded.</div>}
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-widest text-critical">Missing elements</div>
        {missing.length ? (
          <ul className="space-y-2 text-sm">
            {missing.map((x, j) => (
              <li key={j} className="rounded-sm border border-critical/20 bg-critical-soft/20 p-2">
                <div className="flex gap-1.5"><span className="text-critical">✗</span><span className="font-medium">{x.element}</span></div>
                {x.evidence && (
                  <div className="mt-1 border-l-2 border-critical/40 pl-2 text-xs italic text-muted-foreground">
                    <span className="not-italic font-medium text-foreground/70">Guideline expects: </span>"{x.evidence}"
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <div className="text-xs text-muted-foreground">None recorded.</div>}
      </div>
    </div>
  );
}
