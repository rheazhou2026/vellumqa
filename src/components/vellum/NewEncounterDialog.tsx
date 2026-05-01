import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Plus, Loader2 } from "lucide-react";

const SPECIALTIES = [
  "emergency_medicine", "primary_care", "pediatrics", "cardiology",
  "psychiatry", "oncology", "surgery", "critical_care",
];

const PLACEHOLDER_NOTE = `CHIEF COMPLAINT: Chest pain x 2 hrs.
HPI: 58yo M with HTN reports substernal pressure, radiating to left arm, diaphoretic. No prior MI.
ROS: Negative for fever.
EXAM: BP 158/94, HR 102, SpO2 96%. Lungs clear. Cardiac RRR.
ASSESSMENT: Atypical chest pain, likely musculoskeletal.
PLAN: Discharge with ibuprofen. Follow up in 1 week.`;

const PLACEHOLDER_SOURCE = `[transcript]
Clinician: When did the pain start?
Patient: About two hours ago, like a heavy weight on my chest...

[ehr]
Vitals: BP 158/94, HR 102, SpO2 96%. EKG pending. Troponin pending.

[labs]
Troponin I: 0.04 ng/mL`;

type SourceType = "transcript" | "ehr" | "labs";
const TAG_TO_TYPE: Record<string, SourceType> = {
  transcript: "transcript",
  conversation: "transcript",
  dialogue: "transcript",
  ehr: "ehr",
  chart: "ehr",
  vitals: "ehr",
  labs: "labs",
  lab: "labs",
  results: "labs",
};

function parseSourceSections(raw: string): { type: SourceType; text: string }[] {
  const text = raw.trim();
  if (!text) return [];
  const re = /\[([a-zA-Z_]+)\]\s*/g;
  const matches: { tag: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({ tag: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  if (matches.length === 0) {
    return [{ type: "transcript", text }];
  }
  const buckets: Record<SourceType, string[]> = { transcript: [], ehr: [], labs: [] };
  // text before first tag → transcript
  const preface = text.slice(0, matches[0].start).trim();
  if (preface) buckets.transcript.push(preface);
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const body = text.slice(cur.end, next ? next.start : text.length).trim();
    if (!body) continue;
    const type = TAG_TO_TYPE[cur.tag] ?? "transcript";
    buckets[type].push(body);
  }
  return (Object.keys(buckets) as SourceType[])
    .filter((t) => buckets[t].length > 0)
    .map((t) => ({ type: t, text: buckets[t].join("\n\n") }));
}

export default function NewEncounterDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [specialty, setSpecialty] = useState<string>("");
  const [chief, setChief] = useState("");
  const [visit, setVisit] = useState("");
  const [vendor, setVendor] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  const navigate = useNavigate();

  async function submit() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (!specialty) throw new Error("Please choose a specialty");

      const { data: enc, error: encErr } = await supabase
        .from("encounters")
        .insert({
          user_id: u.user.id,
          specialty,
          care_setting: "outpatient",
          chief_complaint: chief || null,
          visit_type: visit || null,
          ai_vendor: vendor || null,
        })
        .select()
        .single();
      if (encErr) throw encErr;

      // source(s) — split by [transcript] / [ehr] / [labs] tags
      if (source.trim()) {
        const sections = parseSourceSections(source);
        const rows = sections.map((s) => ({
          encounter_id: enc.id,
          source_type: s.type,
          content: { text: s.text },
        }));
        if (rows.length) await supabase.from("encounter_sources").insert(rows);
      }

      // note artifact
      const { error: artErr } = await supabase.from("note_artifacts").insert({
        encounter_id: enc.id,
        artifact_type: "soap_note",
        content: { text: note },
        raw_text: note,
        status: "pending_review",
      });
      if (artErr) throw artErr;

      await supabase.from("audit_events").insert({
        user_id: u.user.id,
        encounter_id: enc.id,
        event_type: "encounter_created",
        event_data: { specialty, vendor },
      });

      toast.success("Encounter created. Running Vellum evaluation…");
      setOpen(false);
      onCreated?.();

      // Fire-and-route: kick off evaluation, then go to detail.
      // Pass `?evaluating=1` so the detail page shows a clear loading state
      // until the realtime subscription brings in the completed run.
      supabase.functions
        .invoke("evaluate-encounter", { body: { encounter_id: enc.id } })
        .then(({ error }) => {
          if (error) toast.error(`Evaluation failed: ${error.message}`);
          else toast.success("Evaluation complete");
        });
      navigate(`/encounters/${enc.id}?evaluating=1`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create encounter");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent-hover">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New encounter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Ingest encounter</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Specialty</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select a specialty…" /></SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Visit type</Label>
            <Input className="mt-1" placeholder="e.g. ED visit" value={visit} onChange={(e) => setVisit(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Chief complaint</Label>
            <Input className="mt-1" placeholder="e.g. Chest pain" value={chief} onChange={(e) => setChief(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">AI vendor / model</Label>
            <Input className="mt-1" placeholder="e.g. OpenEvidence v3.2" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Source evidence</Label>
            <Textarea className="mt-1 font-mono text-xs min-h-[140px]" placeholder={PLACEHOLDER_SOURCE} value={source} onChange={(e) => setSource(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1">
              Use <code>[transcript]</code>, <code>[ehr]</code>, <code>[labs]</code> tags to separate sections. Untagged text is treated as transcript.
            </p>
          </div>
          <div className="col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">AI-generated note</Label>
            <Textarea className="mt-1 font-mono text-xs min-h-[180px]" placeholder={PLACEHOLDER_NOTE} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !note.trim() || !specialty} className="bg-accent text-accent-foreground hover:bg-accent-hover">
            {busy ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Ingesting…</> : "Ingest & evaluate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}