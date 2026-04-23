import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SectionCard } from "@/components/clinical/SectionCard";
import { toast } from "sonner";
import { BookMarked, Plus, Trash2 } from "lucide-react";

export default function Guidelines() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", organization: "", specialty: "", condition_keywords: "", summary: "", recommendations: "", red_flags: "", citation: "" });

  const load = async () => {
    const { data } = await supabase.from("clinical_guidelines").select("*").order("organization");
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = {
      ...form,
      condition_keywords: form.condition_keywords.split(",").map((s) => s.trim()).filter(Boolean),
      created_by: u.user.id,
    };
    const { error } = await supabase.from("clinical_guidelines").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Guideline added");
    setOpen(false);
    setForm({ name: "", organization: "", specialty: "", condition_keywords: "", summary: "", recommendations: "", red_flags: "", citation: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("clinical_guidelines").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); load(); }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-accent">Guidelines Library</div>
          <h1 className="mt-2 font-display text-4xl font-semibold">Evidence the auditor uses</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            The QA engine cross-references every note against the active guidelines below.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-ink text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Add guideline</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>New clinical guideline</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Organization</Label><Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="AHA / NAEPP" /></div>
                <div><Label>Specialty</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Cardiology" /></div>
              </div>
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Condition keywords (comma-separated)</Label><Input value={form.condition_keywords} onChange={(e) => setForm({ ...form, condition_keywords: e.target.value })} placeholder="chest pain, angina, acs" /></div>
              <div><Label>Summary</Label><Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
              <div><Label>Recommendations</Label><Textarea rows={4} value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} /></div>
              <div><Label>Red flags</Label><Textarea rows={2} value={form.red_flags} onChange={(e) => setForm({ ...form, red_flags: e.target.value })} /></div>
              <div><Label>Citation</Label><Input value={form.citation} onChange={(e) => setForm({ ...form, citation: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <SectionCard icon={BookMarked} title="Active guidelines" eyebrow={`${items.length} entries`}>
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((g) => (
            <div key={g.id} className="paper-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-accent">{g.organization}</div>
                  <div className="font-display text-lg font-semibold">{g.name}</div>
                  <div className="text-xs text-muted-foreground">{g.specialty}</div>
                </div>
                <button onClick={() => remove(g.id)} className="text-muted-foreground hover:text-critical"><Trash2 className="h-4 w-4" /></button>
              </div>
              <p className="mt-3 text-sm text-foreground/80">{g.summary}</p>
              <pre className="mt-3 whitespace-pre-wrap rounded-md bg-surface-muted p-3 text-xs">{g.recommendations}</pre>
              <div className="mt-2 flex flex-wrap gap-1">{(g.condition_keywords ?? []).map((k: string) => <span key={k} className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[11px]">{k}</span>)}</div>
              {g.citation && <div className="mt-2 text-[11px] text-muted-foreground">{g.citation}</div>}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}