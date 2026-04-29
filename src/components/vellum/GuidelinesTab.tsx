import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Pencil, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type GuidelineSource = {
  id: string;
  name: string;
  abbreviation: string | null;
  specialty: string | null;
  source_type: string | null;
  source_url: string | null;
  active: boolean;
};

type GuidelineVersion = {
  id: string;
  source_id: string;
  version_string: string;
  effective_date: string | null;
  is_current: boolean;
  retired_date: string | null;
};

const SPECIALTIES = [
  "emergency_medicine","internal_medicine","cardiology","neurology",
  "pediatrics","obstetrics","psychiatry","surgery","oncology","general",
];

const SOURCE_TYPES = ["national_guideline","society_guideline","local_policy"];

type FormState = {
  id?: string;
  versionId?: string;
  name: string;
  abbreviation: string;
  specialty: string;
  source_type: string;
  source_url: string;
  version_string: string;
  effective_date: string;
};

const emptyForm: FormState = {
  name: "", abbreviation: "", specialty: "general",
  source_type: "national_guideline", source_url: "",
  version_string: "1.0", effective_date: format(new Date(), "yyyy-MM-dd"),
};

export default function GuidelinesTab() {
  const [sources, setSources] = useState<GuidelineSource[]>([]);
  const [versions, setVersions] = useState<GuidelineVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [srcRes, verRes] = await Promise.all([
      supabase.from("guideline_sources").select("*").order("name"),
      supabase.from("guideline_versions").select("*").order("effective_date", { ascending: false }),
    ]);
    setSources((srcRes.data ?? []) as GuidelineSource[]);
    setVersions((verRes.data ?? []) as GuidelineVersion[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const currentVersionFor = (sourceId: string) =>
    versions.find((v) => v.source_id === sourceId && v.is_current) ??
    versions.find((v) => v.source_id === sourceId);

  const openNew = () => { setForm(emptyForm); setOpen(true); };

  const openEdit = (s: GuidelineSource) => {
    const v = currentVersionFor(s.id);
    setForm({
      id: s.id,
      versionId: v?.id,
      name: s.name,
      abbreviation: s.abbreviation ?? "",
      specialty: s.specialty ?? "general",
      source_type: s.source_type ?? "national_guideline",
      source_url: s.source_url ?? "",
      version_string: v?.version_string ?? "1.0",
      effective_date: v?.effective_date ?? format(new Date(), "yyyy-MM-dd"),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      let sourceId = form.id;
      const sourcePayload = {
        name: form.name.trim(),
        abbreviation: form.abbreviation.trim() || null,
        specialty: form.specialty,
        source_type: form.source_type,
        source_url: form.source_url.trim() || null,
      };
      if (sourceId) {
        const { error } = await supabase.from("guideline_sources").update(sourcePayload).eq("id", sourceId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("guideline_sources").insert(sourcePayload).select("id").single();
        if (error) throw error;
        sourceId = data.id;
      }

      if (form.versionId) {
        const { error } = await supabase.from("guideline_versions").update({
          version_string: form.version_string,
          effective_date: form.effective_date || null,
        }).eq("id", form.versionId);
        if (error) throw error;
      } else if (sourceId) {
        // mark all existing as not current then insert new current
        await supabase.from("guideline_versions").update({ is_current: false }).eq("source_id", sourceId);
        const { error } = await supabase.from("guideline_versions").insert({
          source_id: sourceId,
          version_string: form.version_string,
          effective_date: form.effective_date || null,
          is_current: true,
        });
        if (error) throw error;
      }

      toast.success("Guideline saved");
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => ({
    total: sources.length,
    active: sources.filter((s) => s.active).length,
  }), [sources]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-heading text-[10px] uppercase tracking-widest text-tertiary">Library</div>
          <h2 className="font-display text-2xl mt-1">Guideline sources</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.active} active · {stats.total} total
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Add Guideline
        </Button>
      </div>

      <div className="vellum-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Abbrev.</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Current Version</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            )}
            {!loading && sources.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No guidelines yet. Add your first one.</TableCell></TableRow>
            )}
            {sources.map((s) => {
              const v = currentVersionFor(s.id);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {s.name}
                      {s.source_url && (
                        <a href={s.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.abbreviation ?? "—"}</TableCell>
                  <TableCell className="text-sm">{s.specialty ?? "—"}</TableCell>
                  <TableCell><TypeBadge type={s.source_type} /></TableCell>
                  <TableCell className="font-mono text-xs">{v?.version_string ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {v?.effective_date ? format(new Date(v.effective_date), "yyyy-MM-dd") : "—"}
                  </TableCell>
                  <TableCell><StatusBadge active={s.active} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit guideline" : "Add guideline"}</DialogTitle>
            <DialogDescription>Manage the library entry and its current version.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Abbreviation</Label>
                <Input value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} maxLength={32} />
              </div>
              <div className="grid gap-2">
                <Label>Specialty</Label>
                <Select value={form.specialty} onValueChange={(v) => setForm({ ...form, specialty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Source Type</Label>
              <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Source URL</Label>
              <Input type="url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://…" maxLength={500} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Version String</Label>
                <Input value={form.version_string} onChange={(e) => setForm({ ...form, version_string: e.target.value })} maxLength={64} />
              </div>
              <div className="grid gap-2">
                <Label>Effective Date</Label>
                <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-success-bg text-success border border-success/30">
      <span className="h-1.5 w-1.5 rounded-full bg-success" /> Active
    </span>;
  }
  return <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-secondary text-muted-foreground border border-border">
    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Retired
  </span>;
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="font-mono text-[10px] text-tertiary">—</span>;
  const styles: Record<string, string> = {
    national_guideline: "bg-info-bg text-info border-info/30",
    society_guideline: "bg-accent/10 text-accent border-accent/30",
    local_policy: "bg-secondary text-muted-foreground border-border",
  };
  return <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm border ${styles[type] ?? "bg-secondary border-border"}`}>{type}</span>;
}
