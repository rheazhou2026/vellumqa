import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";

export default function Review() {
  return (
    <div>
      <PageHeader eyebrow="Console / QA" title="Review workbench" description="Triage and adjudicate AI-generated documentation flagged for clinician review." />
      <div className="p-6 grid lg:grid-cols-4 gap-4">
        {["Pending","In Review","Needs Escalation","Completed"].map((col) => (
          <div key={col} className="vellum-panel p-4 min-h-[280px]">
            <div className="font-heading text-xs uppercase tracking-wider text-muted-foreground mb-3">{col}</div>
            <div className="text-xs text-tertiary">No assignments.</div>
          </div>
        ))}
      </div>
      <div className="px-6 pb-6">
        <StubPanel title="Kanban + filters" description="Cards show encounter ID, specialty, trust score pill, top 3 flags, due date. Drag between columns logs to audit_events." />
      </div>
    </div>
  );
}