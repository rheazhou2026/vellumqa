import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/clinical/SectionCard";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Activity, BookMarked, ShieldCheck, MapPin } from "lucide-react";

interface CheckResult { ok: boolean; label: string; detail?: string; }

const EXPECTED_GUIDELINES = ["AHA", "NAEPP", "ICHD", "IDSA", "ADA"];

export default function Diagnostics() {
  const location = useLocation();
  const [running, setRunning] = useState(false);
  const [authChecks, setAuthChecks] = useState<CheckResult[]>([]);
  const [guidelineRows, setGuidelineRows] = useState<{ org: string; count: number; ok: boolean }[]>([]);
  const [edgeOk, setEdgeOk] = useState<CheckResult | null>(null);

  const runAll = async () => {
    setRunning(true);
    setAuthChecks([]);
    setGuidelineRows([]);
    setEdgeOk(null);

    // Auth checks
    const checks: CheckResult[] = [];
    const { data: sessionData } = await supabase.auth.getSession();
    checks.push({
      ok: !!sessionData.session,
      label: "Active session",
      detail: sessionData.session ? `Signed in as ${sessionData.session.user.email}` : "No session detected. Sign in at /auth.",
    });

    if (sessionData.session) {
      const userId = sessionData.session.user.id;
      const { data: roles, error: roleErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const hasReviewer = (roles ?? []).some((r) => r.role === "reviewer" || r.role === "admin");
      checks.push({
        ok: hasReviewer && !roleErr,
        label: "Role assignment",
        detail: roleErr
          ? `Role lookup failed: ${roleErr.message}`
          : hasReviewer
          ? `Roles: ${(roles ?? []).map((r) => r.role).join(", ")}`
          : "No reviewer or admin role assigned. The signup trigger should grant 'reviewer'.",
      });

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();
      checks.push({
        ok: !!profile && !profErr,
        label: "Profile row",
        detail: profErr ? profErr.message : profile ? `Display name: ${profile.display_name ?? "(empty)"}` : "Profile row missing.",
      });
    }
    setAuthChecks(checks);

    // Guidelines
    const { data: guidelines, error: gErr } = await supabase
      .from("clinical_guidelines")
      .select("organization, name")
      .eq("active", true);
    if (gErr) {
      setGuidelineRows([{ org: "(error)", count: 0, ok: false }]);
    } else {
      const counts: Record<string, number> = {};
      for (const g of guidelines ?? []) {
        const key = g.organization ?? "(unknown)";
        counts[key] = (counts[key] || 0) + 1;
      }
      const rows: { org: string; count: number; ok: boolean }[] = [];
      for (const expected of EXPECTED_GUIDELINES) {
        const matching = Object.keys(counts).find((k) => k.toUpperCase().includes(expected));
        const count = matching ? counts[matching] : 0;
        rows.push({ org: matching ?? expected, count, ok: count > 0 });
        if (matching) delete counts[matching];
      }
      for (const [org, count] of Object.entries(counts)) {
        rows.push({ org, count, ok: true });
      }
      setGuidelineRows(rows);
    }

    // Edge function reachability check (OPTIONS preflight)
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-note`;
      const resp = await fetch(url, { method: "OPTIONS" });
      setEdgeOk({
        ok: resp.ok || resp.status === 200 || resp.status === 204,
        label: "analyze-note edge function reachable",
        detail: `OPTIONS ${url} returned ${resp.status}`,
      });
    } catch (e: any) {
      setEdgeOk({ ok: false, label: "analyze-note edge function reachable", detail: e?.message ?? "Network error" });
    }

    setRunning(false);
  };

  useEffect(() => {
    runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Indicator = ({ ok }: { ok: boolean }) =>
    ok ? <CheckCircle2 className="h-4 w-4 text-safe" /> : <XCircle className="h-4 w-4 text-critical" />;

  const seedsOk = guidelineRows.length > 0 && guidelineRows.every((r) => r.ok);
  const authOk = authChecks.length > 0 && authChecks.every((c) => c.ok);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-accent">System</div>
          <h1 className="mt-2 font-display text-4xl font-semibold">Diagnostics</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verify backend health, login flow, and guideline seed data so audits never come back empty.
          </p>
        </div>
        <Button onClick={runAll} disabled={running} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> Re-run checks
        </Button>
      </header>

      <SectionCard icon={MapPin} title="Current route" eyebrow="Routing">
        <div className="font-mono text-sm">{location.pathname}{location.search}{location.hash}</div>
        <p className="mt-2 text-xs text-muted-foreground">If you ever land on a blank page, check that this matches what you expect. Unknown routes are caught by the fallback page.</p>
      </SectionCard>

      <SectionCard icon={ShieldCheck} title="Login health check" eyebrow={authOk ? "Healthy" : "Issues detected"}>
        <ul className="space-y-2">
          {authChecks.map((c, i) => (
            <li key={i} className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
              <Indicator ok={c.ok} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.label}</div>
                {c.detail && <div className="mt-0.5 text-xs text-muted-foreground">{c.detail}</div>}
              </div>
            </li>
          ))}
          {authChecks.length === 0 && <li className="text-sm text-muted-foreground">Running…</li>}
        </ul>
      </SectionCard>

      <SectionCard icon={BookMarked} title="Clinical guideline seeds" eyebrow={seedsOk ? "All seeds loaded" : "Some seeds missing"}>
        <p className="mb-3 text-xs text-muted-foreground">
          Audits cross-reference these libraries. Empty rows mean QA output won't include that guideline.
        </p>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr><th className="px-3 py-2">Organization</th><th className="px-3 py-2">Active rows</th><th className="px-3 py-2">Status</th></tr>
            </thead>
            <tbody>
              {guidelineRows.map((r) => (
                <tr key={r.org} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.org}</td>
                  <td className="px-3 py-2 font-mono">{r.count}</td>
                  <td className="px-3 py-2">
                    <Indicator ok={r.ok} />
                  </td>
                </tr>
              ))}
              {guidelineRows.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">Running…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Manage seeds in <Link to="/app/guidelines" className="text-accent underline">Guidelines Library</Link>.
        </div>
      </SectionCard>

      <SectionCard icon={Activity} title="Edge function reachability" eyebrow="Backend">
        {edgeOk ? (
          <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
            <Indicator ok={edgeOk.ok} />
            <div>
              <div className="text-sm font-medium">{edgeOk.label}</div>
              {edgeOk.detail && <div className="mt-0.5 text-xs text-muted-foreground">{edgeOk.detail}</div>}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" /> Running…
          </div>
        )}
      </SectionCard>
    </div>
  );
}
