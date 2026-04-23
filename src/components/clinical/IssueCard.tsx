import { SeverityBadge } from "./SeverityBadge";
import { CATEGORY_LABELS } from "@/lib/clinical-types";
import { ArrowRight, GitMerge } from "lucide-react";

interface Issue {
  category: string;
  severity: "critical" | "important" | "minor" | "info";
  description: string;
  suggested_fix?: string;
  next_best_step?: string;
  root_cause?: string;
  subpoints?: string[];
}

const ACCENT: Record<string, string> = {
  critical: "border-l-critical",
  important: "border-l-important",
  minor: "border-l-muted-foreground/40",
  info: "border-l-info",
};

export function IssueCard({ issue }: { issue: Issue }) {
  const consolidated = !!(issue.subpoints && issue.subpoints.length > 0);
  return (
    <div className={`rounded-md border border-border border-l-4 ${ACCENT[issue.severity] ?? "border-l-border"} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={issue.severity} />
        <span className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          {CATEGORY_LABELS[issue.category as keyof typeof CATEGORY_LABELS] ?? issue.category}
        </span>
        {consolidated && (
          <span className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-accent">
            <GitMerge className="h-3 w-3" />
            Consolidated · {issue.subpoints!.length} merged
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug">{issue.description}</p>
      {consolidated && (
        <div className="mt-3 rounded-md border border-border bg-surface-muted/40 p-3">
          <div className="flex items-start gap-2">
            <GitMerge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Root-cause group</div>
              <p className="mt-0.5 text-sm">
                <span className="font-medium text-foreground">
                  {issue.root_cause ?? "Single underlying failure"}
                </span>{" "}
                <span className="text-muted-foreground">
                  consolidates the {issue.subpoints!.length} related finding{issue.subpoints!.length === 1 ? "" : "s"} below into this one top-level issue.
                </span>
              </p>
              <ul className="mt-2 space-y-1">
                {issue.subpoints!.map((sp, i) => (
                  <li key={i} className="flex gap-2 text-xs text-foreground/80">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>{sp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {!consolidated && issue.root_cause && (
        <p className="mt-1 text-xs italic text-muted-foreground">Root cause: {issue.root_cause}</p>
      )}
      {issue.next_best_step && (
        <div className="mt-3 flex items-start gap-2 rounded-sm border border-accent/30 bg-accent/5 p-2.5">
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-accent">Next best step</div>
            <p className="mt-0.5 text-sm">{issue.next_best_step}</p>
          </div>
        </div>
      )}
      {issue.suggested_fix && !issue.next_best_step && (
        <p className="mt-2 text-sm text-muted-foreground">{issue.suggested_fix}</p>
      )}
    </div>
  );
}