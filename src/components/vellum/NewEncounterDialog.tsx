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

const SAMPLE_NOTE = `CHIEF COMPLAINT: Chest pain x 2 hrs.\nHPI: 58yo M with HTN reports substernal pressure, radiating to left arm, diaphoretic. No prior MI.\nROS: Negative for fever.\nEXAM: BP 158/94, HR 102, SpO2 96%. Lungs clear. Cardiac RRR.\nASSESSMENT: Atypical chest pain, likely musculoskeletal.\nPLAN: Discharge with ibuprofen. Follow up in 1 week.`;

const SAMPLE_SOURCE = `[transcript]\nClinician: When did the pain start?\nPatient: About two hours ago, like a heavy weight on my chest. It went down my left arm.\nClinician: Any sweating?\nPatient: Yes, a lot.\nClinician: Any history of heart problems?\nPatient: My father had a heart attack at 55. I take lisinopril for blood pressure.\n\n[ehr]\nVitals: BP 158/94, HR 102, SpO2 96%, T 98.6. EKG pending. Troponin pending.`;

export default function NewEncounterDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [specialty, setSpecialty] = useState("emergency_medicine");
  const [chief, setChief] = useState("Chest pain");
  const [visit, setVisit] = useState("ED visit");
  const [vendor, setVendor] = useState("OpenEvidence v3.2");
  const [note, setNote] = useState(SAMPLE_NOTE);
  const [source, setSource] = useState(SAMPLE_SOURCE);
  const navigate = useNavigate();

  async function submit() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

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

      // Fire-and-route: kick off evaluation, then go to detail
      supabase.functions
        .invoke("evaluate-encounter", { body: { encounter_id: enc.id } })
        .then(({ error }) => {
          if (error) toast.error(`Evaluation failed: ${error.message}`);
          else toast.success("Evaluation complete");
        });
      navigate(`/encounters/${enc.id}`);
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
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Visit type</Label>
            <Input className="mt-1" value={visit} onChange={(e) => setVisit(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Chief complaint</Label>
            <Input className="mt-1" value={chief} onChange={(e) => setChief(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">AI vendor / model</Label>
            <Input className="mt-1" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Source evidence (transcript / EHR / labs)</Label>
            <Textarea className="mt-1 font-mono text-xs min-h-[140px]" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">AI-generated note</Label>
            <Textarea className="mt-1 font-mono text-xs min-h-[180px]" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !note.trim()} className="bg-accent text-accent-foreground hover:bg-accent-hover">
            {busy ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Ingesting…</> : "Ingest & evaluate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}