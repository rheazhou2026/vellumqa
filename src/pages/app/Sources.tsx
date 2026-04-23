import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/clinical/SectionCard";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Cpu, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Sources() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", vendor: "", model_version: "", description: "" });

  const load = async () => {
    const { data } = await supabase.from("ai_sources").select("*").order("name");
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("ai_sources").insert({ ...form, created_by: u.user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("AI source added");
    setOpen(false);
    setForm({ name: "", vendor: "", model_version: "", description: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("ai_sources").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); load(); }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-accent">AI Sources</div>
          <h1 className="mt-2 font-display text-4xl font-semibold">Track which model wrote which note</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Tag every audited note with its AI source to power per-source performance analytics.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-ink text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Add source</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New AI source</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Internal Scribe v3" /></div>
              <div><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="OpenAI" /></div>
              <div><Label>Model version</Label><Input value={form.model_version} onChange={(e) => setForm({ ...form, model_version: e.target.value })} placeholder="gpt-5-2026-01" /></div>
              <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <SectionCard icon={Cpu} title="Configured sources" eyebrow={`${items.length} sources`}>
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No AI sources yet.</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((s) => (
              <div key={s.id} className="paper-card flex items-start justify-between p-4">
                <div>
                  <div className="font-display text-lg font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{[s.vendor, s.model_version].filter(Boolean).join(" · ")}</div>
                  {s.description && <p className="mt-2 text-sm text-foreground/80">{s.description}</p>}
                </div>
                <button onClick={() => remove(s.id)} className="text-muted-foreground hover:text-critical"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}