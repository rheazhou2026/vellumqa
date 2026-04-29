import { useParams } from "react-router-dom";
import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";

export default function EvaluationReport() {
  const { id } = useParams();
  return (
    <div>
      <PageHeader eyebrow={`AUDIT PACK // ${id}`} title="Full evaluation report" description="Printable, regulator-ready audit trail for this encounter." />
      <div className="p-6 space-y-4">
        <StubPanel title="Executive summary" description="Trust Score gauge, all 10 sub-scores, critical failures, recommended action." />
        <StubPanel title="Rubric load manifest" description="Loaded vs excluded modules, with reasons and guideline versions used." />
        <StubPanel title="Clinical claim ledger" description="Every extracted claim with type, status, evidence link, confidence, and risk weight." />
        <StubPanel title="Domain-by-domain results" description="Criterion table per domain, expandable to show evidence and explanation." />
        <StubPanel title="Audit trace + export" description="Encounter / artifact hashes, evaluator versions, and a one-click PDF export via React PDF." />
      </div>
    </div>
  );
}