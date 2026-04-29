import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, CircleSlash, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Verdict = "correct" | "incorrect" | "partial";

export type FindingFeedbackProps = {
  runId: string | undefined;
  findingType:
    | "criterion"
    | "reasoning_strength"
    | "reasoning_gap"
    | "guideline_match"
    | "red_flag"
    | "cognitive_bias"
    | "claim";
  findingKey: string;
  compact?: boolean;
};

export default function FindingFeedback({
  runId,
  findingType,
  findingKey,
  compact,
}: FindingFeedbackProps) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [explanation, setExplanation] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("finding_feedback")
        .select("verdict, explanation")
        .eq("evaluation_run_id", runId)
        .eq("reviewer_id", uid)
        .eq("finding_type", findingType)
        .eq("finding_key", findingKey)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setVerdict(data.verdict as Verdict);
        setExplanation(data.explanation ?? "");
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, findingType, findingKey]);

  async function submit(next: Verdict, note?: string) {
    if (!runId) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const payload = {
        evaluation_run_id: runId,
        reviewer_id: uid,
        finding_type: findingType,
        finding_key: findingKey,
        verdict: next,
        explanation: note ?? explanation ?? null,
      };
      const { error } = await supabase
        .from("finding_feedback")
        .upsert(payload, {
          onConflict: "evaluation_run_id,reviewer_id,finding_type,finding_key",
        });
      if (error) throw error;
      setVerdict(next);
      toast.success("Feedback saved", { description: "Future scoring will use this signal." });
      setShowInput(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save feedback");
    } finally {
      setBusy(false);
    }
  }

  const btn = (v: Verdict, Icon: any, label: string, tone: string) => (
    <button
      type="button"
      disabled={busy || !runId}
      onClick={() => {
        if (v === "incorrect" || v === "partial") {
          setShowInput(true);
          setVerdict(v);
        } else {
          submit(v);
        }
      }}
      className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border transition ${
        verdict === v ? tone : "border-border text-tertiary hover:text-foreground hover:border-foreground/40"
      }`}
      title={label}
    >
      <Icon className="h-2.5 w-2.5" /> {compact ? "" : label}
    </button>
  );

  if (!loaded && runId) {
    return <Loader2 className="h-3 w-3 animate-spin text-tertiary" />;
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-tertiary mr-0.5">
          Reviewer feedback
        </span>
        {btn("correct", Check, "Correct", "border-pass/60 bg-pass/10 text-pass")}
        {btn("partial", CircleSlash, "Partial", "border-moderate/60 bg-moderate/10 text-moderate")}
        {btn("incorrect", X, "False positive", "border-critical/60 bg-critical/10 text-critical")}
        {verdict && !showInput && (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="font-mono text-[9px] uppercase tracking-widest text-accent hover:text-accent-hover"
          >
            Edit note
          </button>
        )}
      </div>
      {showInput && (
        <div className="flex items-start gap-2">
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Why? (e.g. 'Source actually mentions ASA at 14:32')"
            className="flex-1 text-[11px] bg-surface border border-border rounded-sm p-1.5 font-mono resize-none"
            rows={2}
          />
          <button
            type="button"
            disabled={busy || !verdict}
            onClick={() => verdict && submit(verdict, explanation)}
            className="font-mono text-[10px] uppercase tracking-widest bg-accent text-accent-foreground px-2 py-1 rounded-sm hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}