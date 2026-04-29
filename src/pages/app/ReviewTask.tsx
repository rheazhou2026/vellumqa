import { useParams } from "react-router-dom";
import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";

export default function ReviewTask() {
  const { id } = useParams();
  return (
    <div>
      <PageHeader eyebrow={`REVIEW TASK // ${id}`} title="Adjudicate findings" description="Per-criterion agree / disagree / partial with notes, then approve, request edits, escalate, or send to compliance." />
      <div className="p-6 grid lg:grid-cols-3 gap-4">
        <StubPanel title="Source evidence" description="Same source pane as encounter detail." />
        <StubPanel title="AI note" description="Same provenance-annotated note pane." />
        <StubPanel title="Adjudication" description="AGREE / DISAGREE / PARTIAL per criterion, escalate per-finding, save draft, submit final." />
      </div>
    </div>
  );
}