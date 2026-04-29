import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, isBefore, startOfDay, endOfDay, addDays } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle, AlertCircle, Info, ArrowRight, Loader2,
} from "lucide-react";
import PageHeader from "@/components/vellum/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type AssignmentStatus = "pending" | "in_review" | "needs_escalation" | "completed";
type Priority = "all" | "critical" | "urgent" | "routine";
type QueueFilter = "mine" | "all" | "unassigned";
type DueFilter = "all" | "overdue" | "today" | "week";

type Flag = { label: string; severity: "critical" | "high" | "moderate" | "low" };

type Assignment = {
  id: string;
  status: AssignmentStatus;
  priority: string | null;
  reviewer_id: string | null;
  due_at: string | null;
  encounter_id: string;
  encounter?: {
    id: string;
    specialty: string | null;
    patient_id: string | null;
  };
  trust_score: number | null;
  flags: Flag[];
  reviewer_name: string | null;
};

const COLUMNS: { key: AssignmentStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_review", label: "In Review" },
  { key: "needs_escalation", label: "Needs Escalation" },
  { key: "completed", label: "Completed" },
];

const PRIORITIES: { key: Priority; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "urgent", label: "Urgent" },
  { key: "routine", label: "Routine" },
];

const QUEUES: { key: QueueFilter; label: string }[] = [
  { key: "mine", label: "My Queue" },
  { key: "all", label: "All Queue" },
  { key: "unassigned", label: "Unassigned" },
];

const DUE_FILTERS: { key: DueFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due Today" },
  { key: "week", label: "Due This Week" },
];

const SPECIALTY_COLORS: Record<string, string> = {
  emergency_medicine: "bg-critical-bg text-critical border-critical/30",
  internal_medicine: "bg-info-bg text-info border-info/30",
  cardiology: "bg-high-bg text-high border-high/30",
  neurology: "bg-accent/10 text-accent border-accent/30",
  pediatrics: "bg-pass-bg text-pass border-pass/30",
  obstetrics: "bg-moderate-bg text-moderate border-moderate/30",
  psychiatry: "bg-accent/10 text-accent border-accent/30",
  surgery: "bg-high-bg text-high border-high/30",
  oncology: "bg-critical-bg text-critical border-critical/30",
  general: "bg-secondary text-muted-foreground border-border",
};

export default function Review() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("all");
  const [queue, setQueue] = useState<QueueFilter>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<AssignmentStatus | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: aData, error } = await supabase
      .from("reviewer_assignments")
      .select("id,status,priority,reviewer_id,due_at,encounter_id,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const list = (aData ?? []) as any[];
    if (list.length === 0) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    const encIds = Array.from(new Set(list.map((a) => a.encounter_id).filter(Boolean)));
    const reviewerIds = Array.from(new Set(list.map((a) => a.reviewer_id).filter(Boolean)));

    const [encRes, runsRes, profilesRes] = await Promise.all([
      encIds.length
        ? supabase.from("encounters").select("id,specialty,patient_id").in("id", encIds)
        : Promise.resolve({ data: [] as any[] }),
      encIds.length
        ? supabase.from("evaluation_runs").select("id,encounter_id,trust_score").in("encounter_id", encIds)
        : Promise.resolve({ data: [] as any[] }),
      reviewerIds.length
        ? supabase.from("profiles").select("user_id,display_name").in("user_id", reviewerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const runs = (runsRes.data ?? []) as any[];
    const runIds = runs.map((r) => r.id);
    const { data: critData } = runIds.length
      ? await supabase
          .from("criterion_results")
          .select("evaluation_run_id,result,severity,explanation,criterion_id")
          .in("evaluation_run_id", runIds)
          .in("result", ["fail", "critical_fail", "partial"])
      : { data: [] as any[] };

    const encMap = new Map((encRes.data as any[]).map((e) => [e.id, e]));
    const runByEnc = new Map<string, any>();
    for (const r of runs) {
      const prev = runByEnc.get(r.encounter_id);
      if (!prev) runByEnc.set(r.encounter_id, r);
    }
    const profMap = new Map((profilesRes.data as any[]).map((p) => [p.user_id, p.display_name]));
    const flagsByRun = new Map<string, Flag[]>();
    for (const c of (critData ?? []) as any[]) {
      const sev: Flag["severity"] =
        c.result === "critical_fail" ? "critical" :
        (c.severity === "S5" || c.severity === "S4") ? "critical" :
        c.severity === "S3" ? "high" :
        c.severity === "S2" ? "moderate" : "low";
      const arr = flagsByRun.get(c.evaluation_run_id) ?? [];
      arr.push({ label: c.criterion_id ?? c.explanation?.slice(0, 60) ?? "Finding", severity: sev });
      flagsByRun.set(c.evaluation_run_id, arr);
    }

    const sevRank: Record<Flag["severity"], number> = { critical: 0, high: 1, moderate: 2, low: 3 };

    const enriched: Assignment[] = list.map((a) => {
      const enc = encMap.get(a.encounter_id);
      const run = runByEnc.get(a.encounter_id);
      const flags = (flagsByRun.get(run?.id) ?? [])
        .sort((x, y) => sevRank[x.severity] - sevRank[y.severity])
        .slice(0, 3);
      return {
        id: a.id,
        status: (a.status ?? "pending") as AssignmentStatus,
        priority: a.priority,
        reviewer_id: a.reviewer_id,
        due_at: a.due_at,
        encounter_id: a.encounter_id,
        encounter: enc,
        trust_score: run?.trust_score ?? null,
        flags,
        reviewer_name: a.reviewer_id ? (profMap.get(a.reviewer_id) ?? null) : null,
      };
    });

    setAssignments(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const allSpecialties = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => a.encounter?.specialty && set.add(a.encounter.specialty));
    return Array.from(set).sort();
  }, [assignments]);

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const weekEnd = endOfDay(addDays(new Date(), 7));
    return assignments.filter((a) => {
      if (priority !== "all" && (a.priority ?? "routine").toLowerCase() !== priority) return false;
      if (queue === "mine" && a.reviewer_id !== userId) return false;
      if (queue === "unassigned" && a.reviewer_id) return false;
      if (specialties.length > 0 && !(a.encounter?.specialty && specialties.includes(a.encounter.specialty))) return false;
      if (dueFilter !== "all") {
        if (!a.due_at) return false;
        const d = new Date(a.due_at);
        if (dueFilter === "overdue" && !isBefore(d, today)) return false;
        if (dueFilter === "today" && (isBefore(d, today) || isBefore(todayEnd, d))) return false;
        if (dueFilter === "week" && (isBefore(d, today) || isBefore(weekEnd, d))) return false;
      }
      return true;
    });
  }, [assignments, priority, queue, dueFilter, specialties, userId]);

  const grouped = useMemo(() => {
    const g: Record<AssignmentStatus, Assignment[]> = { pending: [], in_review: [], needs_escalation: [], completed: [] };
    for (const a of filtered) {
      const k = (COLUMNS.find((c) => c.key === a.status)?.key) ?? "pending";
      g[k].push(a);
    }
    return g;
  }, [filtered]);

  const moveCard = async (a: Assignment, next: AssignmentStatus) => {
    if (a.status === next) return;
    const prevStatus = a.status;
    setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    const patch: any = { status: next };
    if (next === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("reviewer_assignments").update(patch).eq("id", a.id);
    if (error) {
      toast.error(error.message);
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: prevStatus } : x)));
      return;
    }
    if (userId) {
      await supabase.from("audit_events").insert({
        user_id: userId,
        event_type: "review_status_changed",
        encounter_id: a.encounter_id,
        event_data: { assignment_id: a.id, from: prevStatus, to: next },
      });
    }
    toast.success(`Moved to ${next.replace("_", " ")}`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Console / QA"
        title="Review workbench"
        description="Triage and adjudicate AI-generated documentation flagged for clinician review."
      />

      {/* Filter bar */}
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-3">
        <ToggleGroup
          label="Priority"
          options={PRIORITIES}
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
        />
        <ToggleGroup
          label="Queue"
          options={QUEUES}
          value={queue}
          onChange={(v) => setQueue(v as QueueFilter)}
        />
        <SpecialtyFilter
          options={allSpecialties}
          selected={specialties}
          onChange={setSpecialties}
        />
        <ToggleGroup
          label="Due"
          options={DUE_FILTERS}
          value={dueFilter}
          onChange={(v) => setDueFilter(v as DueFilter)}
        />
      </div>

      {/* Kanban */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const cards = grouped[col.key];
          const showSkeleton = !loading && assignments.length === 0 && col.key === "pending";
          const isOver = overCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={() => {
                setOverCol(null);
                const a = assignments.find((x) => x.id === draggingId);
                setDraggingId(null);
                if (a) moveCard(a, col.key);
              }}
              className={cn(
                "vellum-panel p-3 flex flex-col min-h-[420px] transition",
                isOver && "ring-2 ring-accent/60",
              )}
            >
              <div className="flex items-center justify-between px-1 py-2 border-b border-border mb-3">
                <div className="font-heading text-[10px] uppercase tracking-widest text-foreground">{col.label}</div>
                <span className="font-mono text-[10px] text-tertiary">{cards.length}</span>
              </div>

              <div className="space-y-3 flex-1">
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                  </div>
                )}
                {showSkeleton && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}
                {!loading && !showSkeleton && cards.length === 0 && (
                  <div className="text-xs text-muted-foreground italic px-1 py-6 text-center">No assignments.</div>
                )}
                {cards.map((a) => (
                  <Card
                    key={a.id}
                    a={a}
                    onDragStart={() => setDraggingId(a.id)}
                    onDragEnd={() => setDraggingId(null)}
                    isDragging={draggingId === a.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToggleGroup<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-heading text-[10px] uppercase tracking-widest text-tertiary">{label}</span>
      <div className="flex rounded-md border border-border overflow-hidden">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "px-3 py-1.5 font-mono text-[11px] transition border-r border-border last:border-r-0",
              value === o.key
                ? "bg-foreground text-background"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-muted/60",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SpecialtyFilter({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (s: string) => {
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  };
  return (
    <div className="flex items-center gap-2">
      <span className="font-heading text-[10px] uppercase tracking-widest text-tertiary">Specialty</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="font-mono text-[11px] h-8">
            {selected.length === 0 ? "All" : `${selected.length} selected`}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          {options.length === 0 && <div className="text-xs text-muted-foreground p-2">No specialties yet.</div>}
          {options.map((s) => (
            <label key={s} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-surface-muted/60 cursor-pointer">
              <Checkbox checked={selected.includes(s)} onCheckedChange={() => toggle(s)} />
              <span className="text-xs">{s}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Card({ a, onDragStart, onDragEnd, isDragging }: {
  a: Assignment;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const due = a.due_at ? new Date(a.due_at) : null;
  const overdue = due && a.status !== "completed" && isBefore(startOfDay(due), startOfDay(new Date()));
  const trust = a.trust_score;
  const trustClass =
    trust == null ? "bg-secondary text-muted-foreground border-border" :
    trust < 50 ? "bg-critical-bg text-critical border-critical/40" :
    trust < 80 ? "bg-moderate-bg text-moderate border-moderate/40" :
    "bg-pass-bg text-pass border-pass/40";
  const specialty = a.encounter?.specialty ?? "general";
  const specClass = SPECIALTY_COLORS[specialty] ?? SPECIALTY_COLORS.general;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-md border border-border bg-surface-muted/40 p-3 space-y-2.5 cursor-grab active:cursor-grabbing transition",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-foreground truncate" style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }}>
          {a.encounter_id.slice(0, 8)}
        </span>
        <span className={cn("font-mono text-[10px] px-1.5 py-0.5 rounded-sm border", trustClass)}>
          {trust == null ? "—" : Math.round(trust)}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border", specClass)}>
          {specialty}
        </span>
        {a.priority && (
          <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-border text-muted-foreground">
            {a.priority}
          </span>
        )}
      </div>

      {a.flags.length > 0 && (
        <ul className="space-y-1">
          {a.flags.map((f, i) => (
            <li key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <SeverityIcon sev={f.severity} />
              <span className="truncate">{f.label}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground truncate">{a.reviewer_name ?? "Unassigned"}</span>
        <span className={cn("font-mono", overdue ? "text-critical" : "text-muted-foreground")}>
          {due ? format(due, "MMM d") : "—"}
        </span>
      </div>

      <Link to={`/review/${a.id}`}>
        <Button variant="outline" size="sm" className="w-full h-7 gap-1 text-[11px]">
          Open Review <ArrowRight className="h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}

function SeverityIcon({ sev }: { sev: Flag["severity"] }) {
  if (sev === "critical") return <AlertTriangle className="h-3 w-3 text-critical shrink-0" />;
  if (sev === "high") return <AlertCircle className="h-3 w-3 text-high shrink-0" />;
  return <Info className="h-3 w-3 text-info shrink-0" />;
}

function SkeletonCard() {
  return (
    <div className="rounded-md border border-border bg-surface-muted/40 p-3 space-y-2.5 animate-pulse">
      <div className="h-3 bg-surface-muted rounded w-1/2" />
      <div className="h-4 bg-surface-muted rounded w-2/3" />
      <div className="space-y-1.5">
        <div className="h-2.5 bg-surface-muted rounded w-full" />
        <div className="h-2.5 bg-surface-muted rounded w-4/5" />
        <div className="h-2.5 bg-surface-muted rounded w-3/5" />
      </div>
      <div className="h-7 bg-surface-muted rounded" />
    </div>
  );
}
