import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";

export default function Encounters() {
  return (
    <div>
      <PageHeader eyebrow="Console / Encounters" title="Encounter ledger" description="Every patient encounter with an AI-generated artifact, sortable and filterable by specialty, trust score, severity, and reviewer status." />
      <div className="p-6">
        <StubPanel title="Encounter table — TanStack Table" description="Sticky filter bar, severity-coded trust score pills, bulk actions for assignment and export. Schema is in place; connect ingestion to populate." />
      </div>
    </div>
  );
}