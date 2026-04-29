import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  Play,
  CheckCircle2,
  AlertTriangle,
  Save,
  Beaker,
  Users,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type CalibrationStatus = "calibrated" | "needs_calibration" | "draft";

type Criterion = {
  id: string;
  criterion_id: string;
  name: string;
  domain_id: string | null;
  last_calibrated_at: string | null;
  sensitivity: number | null;
  specificity: number | null;
  clinician_agreement_rate: number | null;
  calibration_status: CalibrationStatus;
  calibration_matrix: Record<string, number> | null;
};

type Domain = { id: string; domain_code: string; name: string };

function StatusBadge({ status }: { status: CalibrationStatus }) {
  const cfg = {
    calibrated: {
      label: "Calibrated",
      cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    },
    needs_calibration: {
      label: "Needs Calibration",
      cls: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    },
    draft: { label: "Draft", cls: "bg-muted text-muted-foreground border-border" },
  }[status];
  return (
    <span
      className={`inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

function pct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  const n = v <= 1 ? v * 100 : v;
  return `${Math.round(n)}%`;
}

export default function CalibrationTab() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [domains, setDomains] = useState<Map<string, Domain>>(new Map());
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Criterion | null>(null);
  const [matrix, setMatrix] = useState({ tp: 0, fp: 0, fn: 0, tn: 0 });
  const [agreement, setAgreement] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: c, error: cErr }, { data: d, error: dErr }] = await Promise.all([
        supabase
          .from("rubric_criteria")
          .select(
            "id, criterion_id, name, domain_id, last_calibrated_at, sensitivity, specificity, clinician_agreement_rate, calibration_status, calibration_matrix",
          )
          .order("criterion_id"),
        supabase.from("rubric_domains").select("id, domain_code, name"),
      ]);
      if (cErr) throw cErr;
      if (dErr) throw dErr;
      setCriteria((c ?? []) as Criterion[]);
      setDomains(new Map((d ?? []).map((x) => [x.id, x as Domain])));
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load rubric criteria.");
    } finally {
      setLoading(false);
    }
  }

  function openTest(c: Criterion) {
    setActive(c);
    const m = c.calibration_matrix ?? {};
    setMatrix({
      tp: Number(m.tp ?? 0) || 0,
      fp: Number(m.fp ?? 0) || 0,
      fn: Number(m.fn ?? 0) || 0,
      tn: Number(m.tn ?? 0) || 0,
    });
    setAgreement(
      c.clinician_agreement_rate != null
        ? c.clinician_agreement_rate <= 1
          ? Math.round(c.clinician_agreement_rate * 100)
          : Math.round(c.clinician_agreement_rate)
        : 0,
    );
  }

  const sens =
    matrix.tp + matrix.fn > 0 ? matrix.tp / (matrix.tp + matrix.fn) : null;
  const spec =
    matrix.tn + matrix.fp > 0 ? matrix.tn / (matrix.tn + matrix.fp) : null;

  function statusFromMetrics(s: number | null, sp: number | null, agreePct: number) {
    if (s == null || sp == null) return "draft" as CalibrationStatus;
    if (s >= 0.85 && sp >= 0.85 && agreePct >= 80) return "calibrated";
    return "needs_calibration";
  }

  async function saveCalibration() {
    if (!active) return;
    if (sens == null || spec == null) {
      toast.error("Enter at least one true positive and one true negative case.");
      return;
    }
    const total = matrix.tp + matrix.fp + matrix.fn + matrix.tn;
    if (total < 4) {
      toast.error("At least 4 evaluated cases are required.");
      return;
    }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const status = statusFromMetrics(sens, spec, agreement);
      const { error } = await supabase
        .from("rubric_criteria")
        .update({
          calibration_matrix: matrix,
          sensitivity: sens,
          specificity: spec,
          clinician_agreement_rate: agreement / 100,
          calibration_status: status,
          last_calibrated_at: new Date().toISOString(),
          last_calibrated_by: userRes?.user?.id ?? null,
        })
        .eq("id", active.id);
      if (error) throw error;
      toast.success(`Calibration saved (${status.replace("_", " ")}).`);
      setActive(null);
      await load();
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.includes("row-level security")
        ? "Admin permissions required to save calibration."
        : e?.message ?? "Save failed.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const stats = useMemo(() => {
    const total = criteria.length;
    const calibrated = criteria.filter((c) => c.calibration_status === "calibrated").length;
    const ratesPct = criteria
      .map((c) => c.clinician_agreement_rate)
      .filter((v): v is number => v != null)
      .map((v) => (v <= 1 ? v * 100 : v));
    const avg =
      ratesPct.length > 0
        ? Math.round(ratesPct.reduce((a, b) => a + b, 0) / ratesPct.length)
        : null;
    return { total, calibrated, avg };
  }, [criteria]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="vellum-panel p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
              Criteria fully calibrated
            </div>
            <Target className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="font-display text-3xl mt-2">
            {stats.calibrated}{" "}
            <span className="text-muted-foreground text-base">of {stats.total}</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
            {stats.total > 0
              ? `${Math.round((stats.calibrated / stats.total) * 100)}% of rubric`
              : "no criteria yet"}
          </div>
        </div>
        <div className="vellum-panel p-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
              Avg. clinician agreement
            </div>
            <Users className="h-3.5 w-3.5 text-accent" />
          </div>
          <div className="font-display text-3xl mt-2">
            {stats.avg == null ? "—" : `${stats.avg}%`}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
            across {criteria.filter((c) => c.clinician_agreement_rate != null).length} measured
            criteria
          </div>
        </div>
      </div>

      {/* Table */}
      <section className="vellum-panel">
        <header className="p-4 border-b border-border">
          <h3 className="font-display text-base flex items-center gap-2">
            <Beaker className="h-4 w-4 text-accent" /> Rubric criteria calibration
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Run a calibration test to record sensitivity, specificity, and clinician agreement.
          </p>
        </header>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading rubric…
          </div>
        ) : criteria.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No rubric criteria yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criterion ID</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Last Calibrated</TableHead>
                <TableHead>Sensitivity</TableHead>
                <TableHead>Specificity</TableHead>
                <TableHead>Clinician Agreement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {criteria.map((c) => {
                const dom = c.domain_id ? domains.get(c.domain_id) : null;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-mono text-[11px]">{c.criterion_id}</div>
                      <div className="text-[11px] text-muted-foreground">{c.name}</div>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {dom?.domain_code ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {c.last_calibrated_at
                        ? format(new Date(c.last_calibrated_at), "yyyy-MM-dd")
                        : "—"}
                    </TableCell>
                    <TableCell>{pct(c.sensitivity)}</TableCell>
                    <TableCell>{pct(c.specificity)}</TableCell>
                    <TableCell>{pct(c.clinician_agreement_rate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.calibration_status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openTest(c)}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Run Test
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Calibration modal */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="h-4 w-4 text-accent" /> Calibration test
            </DialogTitle>
            <DialogDescription>
              {active && (
                <>
                  <span className="font-mono">{active.criterion_id}</span> — {active.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-5">
              {/* 2x2 matrix */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-tertiary mb-2">
                  Confusion matrix
                </div>
                <div className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                  <div />
                  <div className="text-center text-[10px] font-mono uppercase tracking-widest text-tertiary">
                    Clinician: positive
                  </div>
                  <div className="text-center text-[10px] font-mono uppercase tracking-widest text-tertiary">
                    Clinician: negative
                  </div>

                  <div className="text-right text-[10px] font-mono uppercase tracking-widest text-tertiary pr-1">
                    Rubric +
                  </div>
                  <MatrixCell
                    label="TP"
                    value={matrix.tp}
                    onChange={(v) => setMatrix((m) => ({ ...m, tp: v }))}
                    tone="good"
                  />
                  <MatrixCell
                    label="FP"
                    value={matrix.fp}
                    onChange={(v) => setMatrix((m) => ({ ...m, fp: v }))}
                    tone="bad"
                  />

                  <div className="text-right text-[10px] font-mono uppercase tracking-widest text-tertiary pr-1">
                    Rubric −
                  </div>
                  <MatrixCell
                    label="FN"
                    value={matrix.fn}
                    onChange={(v) => setMatrix((m) => ({ ...m, fn: v }))}
                    tone="bad"
                  />
                  <MatrixCell
                    label="TN"
                    value={matrix.tn}
                    onChange={(v) => setMatrix((m) => ({ ...m, tn: v }))}
                    tone="good"
                  />
                </div>
              </div>

              {/* Computed metrics */}
              <div className="grid grid-cols-3 gap-3">
                <Metric label="Sensitivity" value={sens} />
                <Metric label="Specificity" value={spec} />
                <div className="vellum-panel p-3">
                  <Label
                    htmlFor="agree"
                    className="text-[10px] font-mono uppercase tracking-widest text-tertiary"
                  >
                    Clinician agreement %
                  </Label>
                  <Input
                    id="agree"
                    type="number"
                    min={0}
                    max={100}
                    value={agreement}
                    onChange={(e) =>
                      setAgreement(
                        Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))),
                      )
                    }
                    className="mt-1 h-8 font-mono text-base"
                  />
                </div>
              </div>

              {sens != null && spec != null && (
                <div
                  className={`text-[11px] font-mono px-3 py-2 rounded-sm border flex items-center gap-2 ${
                    statusFromMetrics(sens, spec, agreement) === "calibrated"
                      ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/5"
                      : "border-amber-500/40 text-amber-500 bg-amber-500/5"
                  }`}
                >
                  {statusFromMetrics(sens, spec, agreement) === "calibrated" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {statusFromMetrics(sens, spec, agreement) === "calibrated"
                    ? "Meets calibration thresholds (sens ≥ 85%, spec ≥ 85%, agreement ≥ 80%)."
                    : "Below calibration thresholds — will be marked Needs Calibration."}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={saveCalibration}
              disabled={saving}
              className="bg-accent text-accent-foreground hover:bg-accent-hover"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Save calibration
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatrixCell({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  tone: "good" | "bad";
}) {
  return (
    <div
      className={`vellum-panel p-3 border ${
        tone === "good" ? "border-emerald-500/30" : "border-critical/30"
      }`}
    >
      <div
        className={`text-[10px] font-mono uppercase tracking-widest ${
          tone === "good" ? "text-emerald-500" : "text-critical"
        }`}
      >
        {label}
      </div>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="mt-1 h-9 font-display text-xl"
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="vellum-panel p-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-tertiary">
        {label}
      </div>
      <div className="font-display text-2xl mt-1">
        {value == null ? "—" : `${Math.round(value * 100)}%`}
      </div>
    </div>
  );
}

function statusFromMetrics(
  s: number | null,
  sp: number | null,
  agreePct: number,
): CalibrationStatus {
  if (s == null || sp == null) return "draft";
  if (s >= 0.85 && sp >= 0.85 && agreePct >= 80) return "calibrated";
  return "needs_calibration";
}