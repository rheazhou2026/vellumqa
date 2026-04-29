import { useParams } from "react-router-dom";
import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";

export default function EncounterDetail() {
  const { id } = useParams();
  return (
    <div>
      <PageHeader eyebrow={`ENC // ${id}`} title="Encounter audit" description="Three-pane source-to-claim verification: encounter evidence, AI-generated note, Vellum evaluation." />
      <div className="p-6 grid lg:grid-cols-3 gap-4 min-h-[600px]">
        <StubPanel title="Source evidence" description="Tabs for transcript, EHR context, labs, intake. Speaker-labeled spans, timestamps in monospace, gold highlight when a claim is selected." />
        <StubPanel title="AI-generated note" description="Per-sentence provenance icons. Click a claim to highlight supporting source spans on the left and the criterion findings on the right." />
        <StubPanel title="Vellum evaluation" description="Trust Score gauge, 10-domain sub-score grid, critical-failure callouts, criterion result accordion, sticky review action bar." />
      </div>
    </div>
  );
}