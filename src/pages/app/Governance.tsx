import { useEffect, useState } from "react";
import { useParams, NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";
import CalibrationTab from "@/components/vellum/CalibrationTab";
import GuidelinesTab from "@/components/vellum/GuidelinesTab";
import CorrectiveActionsTab from "@/components/vellum/CorrectiveActionsTab";

const TABS = [
  { to: "/governance", label: "Rubric Studio" },
  { to: "/governance/guidelines", label: "Guidelines" },
  { to: "/governance/corrective", label: "Corrective Actions" },
  { to: "/governance/calibration", label: "Calibration" },
];

type Domain = { id: string; domain_code: string; name: string; core_question: string | null; main_failure_type: string | null; display_order: number | null };
type Criterion = { criterion_id: string; name: string; severity_level: string | null; specialty_modules: string[] | null; critical_failure_possible: boolean };

export default function Governance() {
  const { tab = "rubric" } = useParams();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from("rubric_domains").select("*").order("display_order");
      setDomains((d ?? []) as Domain[]);
      const { data: c } = await supabase.from("rubric_criteria").select("criterion_id,name,severity_level,specialty_modules,critical_failure_possible,domain_id");
      setCriteria((c ?? []) as unknown as Criterion[]);
    })();
  }, []);

  return (
    <div>
      <PageHeader eyebrow="Console / Governance" title="Trust governance" description="Manage the evaluation rubric, guideline library, corrective actions, and evaluator calibration." />
      <div className="px-6 border-b border-border flex gap-1">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === "/governance"} className={({ isActive }) => `px-4 py-2.5 font-heading text-xs uppercase tracking-wider border-b-2 -mb-px transition ${isActive ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </NavLink>
        ))}
      </div>
      {tab === "rubric" || !["guidelines","corrective","calibration"].includes(tab) ? (
        <div className="p-6 grid lg:grid-cols-[260px_1fr] gap-6 min-h-[600px]">
          <div className="vellum-panel p-3 h-fit">
            <div className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-2">Rubric Domains</div>
            <div className="space-y-0.5">
              {domains.map((d) => {
                const count = criteria.filter((c) => (c as any).domain_id === d.id).length;
                const active = activeDomain === d.id;
                return (
                  <button key={d.id} onClick={() => setActiveDomain(d.id)} className={`w-full text-left px-3 py-2 rounded-sm font-mono text-xs flex items-center justify-between transition ${active ? "bg-surface-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-muted/50"}`}>
                    <span className="truncate">{d.domain_code}</span>
                    <span className="text-tertiary">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="vellum-panel p-6">
            {activeDomain ? (
              <DomainView domain={domains.find((d) => d.id === activeDomain)!} criteria={criteria.filter((c) => (c as any).domain_id === activeDomain)} />
            ) : (
              <div className="text-sm text-muted-foreground">Select a domain to view criteria.</div>
            )}
          </div>
        </div>
      ) : tab === "calibration" ? (
        <div className="p-6">
          <CalibrationTab />
        </div>
      ) : tab === "guidelines" ? (
        <div className="p-6">
          <GuidelinesTab />
        </div>
      ) : tab === "corrective" ? (
        <div className="p-6">
          <CorrectiveActionsTab />
        </div>
      ) : (
        <div className="p-6">
          <StubPanel title={`${tab} workspace`} description="Library tables, conflict detector, and kanban for corrective actions land in subsequent passes." />
        </div>
      )}
    </div>
  );
}

function DomainView({ domain, criteria }: { domain: Domain; criteria: Criterion[] }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-accent">{domain.domain_code}</div>
      <h2 className="font-display text-3xl mt-1">{domain.name}</h2>
      {domain.core_question && <p className="text-sm text-muted-foreground mt-3 italic">"{domain.core_question}"</p>}
      {domain.main_failure_type && <div className="mt-2 text-xs text-muted-foreground"><span className="font-heading uppercase tracking-wider text-tertiary mr-2">Failure modes:</span>{domain.main_failure_type}</div>}

      <div className="mt-6 border-t border-border">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-2 py-3 border-b border-border font-heading text-[10px] uppercase tracking-widest text-tertiary">
          <div>Criterion</div>
          <div>Severity</div>
          <div>Critical</div>
          <div>Specialties</div>
        </div>
        {criteria.length === 0 && <div className="px-2 py-6 text-sm text-muted-foreground">No criteria in this domain.</div>}
        {criteria.map((c) => (
          <div key={c.criterion_id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-2 py-3 border-b border-border/60 items-center">
            <div>
              <div className="font-mono text-xs text-foreground">{c.criterion_id}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{c.name}</div>
            </div>
            <SeverityPill level={c.severity_level} />
            <div className="font-mono text-[10px] text-muted-foreground">{c.critical_failure_possible ? "YES" : "—"}</div>
            <div className="font-mono text-[10px] text-muted-foreground max-w-[200px] truncate">{(c.specialty_modules ?? []).join(", ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityPill({ level }: { level: string | null }) {
  if (!level) return <span className="font-mono text-[10px] text-tertiary">—</span>;
  const styles: Record<string, string> = {
    S0: "bg-secondary text-muted-foreground",
    S1: "bg-secondary text-muted-foreground",
    S2: "bg-info-bg text-info border border-info/30",
    S3: "bg-moderate-bg text-moderate border border-moderate/40",
    S4: "bg-high-bg text-high border border-high/40",
    S5: "bg-critical-bg text-critical border border-critical/50",
  };
  return <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-sm ${styles[level] ?? "bg-secondary"}`}>{level}</span>;
}