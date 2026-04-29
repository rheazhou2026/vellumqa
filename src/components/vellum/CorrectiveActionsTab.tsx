import { useEffect, useMemo, useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { toast } from "sonner";
import { Plus, ArrowRight, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Status = "open" | "in_progress" | "monitoring" | "closed";
type ActionType = "prompt" | "workflow" | "guideline" | "training" | "model";

type CorrectiveAction = {
  id: string;
  description: string | null;
  action_type: string | null;
  status: string;
  assigned_to: string | null;
  due_at?: string | null;
  completed_at: string | null;
  created_at: string;
};

type Member = { user_id: string | null; display_name: string | null; id: string };

const COLUMNS: { key: Status; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "monitoring", label: "Monitoring" },
  { key: "closed", label: "Closed" },
];

const NEXT: Record<Status, Status | null> = {
  open: "in_progress",
  in_progress: "monitoring",
  monitoring: "closed",
  closed: null,
};

const ACTION_TYPES: ActionType[] = ["prompt", "workflow", "guideline", "training", "model"];

const TYPE_STYLES: Record<string, string> = {
  prompt: "bg-info-bg text-info border-info/30",
  workflow: "bg-accent/10 text-accent border-accent/30",
  guideline: "bg-moderate-bg text-moderate border-moderate/40",
  training: "bg-pass-bg text-pass border-pass/30",
  model: "bg-high-bg text-high border-high/40",
};

type FormState = {
  action_type: ActionType;
  description: string;
  assigned_to: string;
  due_at: Date | undefined;
};

const emptyForm: FormState = {
  action_type: "prompt",
  description: "",
  assigned_to: "",
  due_at: undefined,
};

export default function CorrectiveActionsTab() {
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    // due_at column may or may not exist on the table; select * to be safe
    const [actRes, memRes] = await Promise.all([
      supabase.from("corrective_actions").select("*").order("created_at", { ascending: false }),
      supabase.from("vellum_users").select("id,user_id,display_name").is("removed_at", null),
    ]);
    setActions((actRes.data ?? []) as CorrectiveAction[]);
    setMembers((memRes.data ?? []) as Member[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const memberName = (uid: string | null) =>
    members.find((m) => m.user_id === uid)?.display_name ?? "Unassigned";

  const grouped = useMemo(() => {
    const g: Record<Status, CorrectiveAction[]> = { open: [], in_progress: [], monitoring: [], closed: [] };
    for (const a of actions) {
      const s = (COLUMNS.find((c) => c.key === a.status)?.key) ?? "open";
      g[s].push(a);
    }
    return g;
  }, [actions]);

  const advance = async (a: CorrectiveAction) => {
    const next = NEXT[a.status as Status];
    if (!next) return;
    const patch: any = { status: next };
    if (next === "closed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("corrective_actions").update(patch).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved to ${next.replace("_", " ")}`);
    load();
  };

  const save = async () => {
    if (!form.description.trim()) { toast.error("Description required"); return; }
    setSaving(true);
    try {
      const payload: any = {
        action_type: form.action_type,
        description: form.description.trim(),
        assigned_to: form.assigned_to || null,
        status: "open",
      };
      if (form.due_at) payload.due_at = form.due_at.toISOString();
      const { error } = await supabase.from("corrective_actions").insert(payload);
      if (error) throw error;
      toast.success("Action created");
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-heading text-[10px] uppercase tracking-widest text-tertiary">Workflow</div>
          <h2 className="font-display text-2xl mt-1">Corrective actions</h2>
          <p className="text-sm text-muted-foreground mt-1">{actions.length} actions tracked</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Action
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="vellum-panel p-3 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between px-1 py-2 border-b border-border mb-3">
              <div className="font-heading text-[10px] uppercase tracking-widest text-foreground">{col.label}</div>
              <span className="font-mono text-[10px] text-tertiary">{grouped[col.key].length}</span>
            </div>
            <div className="space-y-3 flex-1">
              {loading && <div className="text-xs text-muted-foreground px-1">Loading…</div>}
              {!loading && grouped[col.key].length === 0 && (
                <div className="text-xs text-muted-foreground italic px-1 py-6 text-center">No actions in this stage.</div>
              )}
              {grouped[col.key].map((a) => (
                <ActionCard
                  key={a.id}
                  action={a}
                  ownerName={memberName(a.assigned_to)}
                  onAdvance={() => advance(a)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New corrective action</DialogTitle>
            <DialogDescription>Track remediation of a quality finding.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Action type</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v as ActionType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                maxLength={1000}
                placeholder="What needs to be addressed?"
              />
            </div>
            <div className="grid gap-2">
              <Label>Assigned to</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                <SelectContent>
                  {members.filter((m) => m.user_id).map((m) => (
                    <SelectItem key={m.id} value={m.user_id!}>{m.display_name ?? "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !form.due_at && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.due_at ? format(form.due_at, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.due_at}
                    onSelect={(d) => setForm({ ...form, due_at: d ?? undefined })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
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

function ActionCard({ action, ownerName, onAdvance }: { action: CorrectiveAction; ownerName: string; onAdvance: () => void }) {
  const due = action.due_at ? new Date(action.due_at) : null;
  const overdue = due && action.status !== "closed" && isBefore(startOfDay(due), startOfDay(new Date()));
  const next = NEXT[action.status as Status];
  return (
    <div className="rounded-md border border-border bg-surface-muted/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className={cn("font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border", TYPE_STYLES[action.action_type ?? ""] ?? "bg-secondary border-border text-muted-foreground")}>
          {action.action_type ?? "action"}
        </span>
        {due && (
          <span className={cn("font-mono text-[10px]", overdue ? "text-critical" : "text-muted-foreground")}>
            {format(due, "MMM d")}
          </span>
        )}
      </div>
      <div className="text-sm text-foreground leading-snug">{action.description ?? "—"}</div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-muted-foreground truncate">{ownerName}</span>
        {next && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={onAdvance}>
            Update <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
