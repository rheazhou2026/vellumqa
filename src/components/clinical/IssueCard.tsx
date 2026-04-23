import { SeverityBadge } from "./SeverityBadge";
import { CATEGORY_LABELS } from "@/lib/clinical-types";
import { ArrowRight } from "lucide-react";

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
  return (
    <div className={`rounded-md border border-border border-l-4 ${ACCENT[issue.severity] ?? "border-l-border"} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={issue.severity} />
        <span className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          {CATEGORY_LABELS[issue.category as keyof typeof CATEGORY_LABELS] ?? issue.category}
        </span>
        {issue.root_cause && (
          <span className="text-[11px] italic text-muted-foreground">root cause: {issue.root_cause}</span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug">{issue.description}</p>
      {issue.subpoints && issue.subpoints.length > 0 && (
        <ul className="mt-2 ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
          {issue.subpoints.map((sp, i) => <li key={i}>{sp}</li>)}
        </ul>
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