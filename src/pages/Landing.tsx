import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Stethoscope, Brain, Layers, BookMarked, Activity, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const capabilities = [
  { icon: Brain, title: "Clinical reasoning audit", body: "Evaluates differential breadth, justification of leading diagnosis, and whether reasoning matches the data presented." },
  { icon: ShieldAlert, title: "Missed red flag detection", body: "Context-aware screening (SNOOP, HEART, sepsis, asthma severity) with severity-graded findings." },
  { icon: Stethoscope, title: "Cognitive bias detection", body: "Surfaces premature closure, anchoring, availability, and attribution bias with cited evidence." },
  { icon: Layers, title: "Bulk processing queue", body: "Drop a CSV or JSON of notes — the queue processes sequentially and writes an aggregate QA report." },
  { icon: BookMarked, title: "Guideline cross-reference", body: "AHA, NAEPP, ICHD, IDSA, ADA — your saved guidelines anchor every evidence-based suggestion." },
  { icon: Activity, title: "AI performance analytics", body: "Track trust scores and issue categories per AI source over time. Catch regressions after model updates." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-ink text-primary-foreground">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">Vellum</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Clinical QA</div>
          </div>
        </Link>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="relative pt-12 pb-20 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Safety oversight for AI-generated notes
            </div>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground lg:text-6xl">
              Audit the <em className="not-italic text-accent">clinical thinking</em>,
              <br />not just the <span className="italic">writing.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Vellum is a clinical reasoning auditor for AI-generated documentation. It detects missed
              red flags, cognitive bias, and weak differentials, then cross-references every finding
              against the guidelines your QA team trusts.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2 bg-gradient-ink text-primary-foreground hover:opacity-90">
                  Start auditing notes <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#capabilities" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                What it audits →
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 overflow-hidden rounded-xl border border-border bg-surface shadow-elevated"
          >
            <div className="flex items-center justify-between border-b border-border bg-surface-muted px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-critical" />
                <div className="h-2 w-2 rounded-full bg-important" />
                <div className="h-2 w-2 rounded-full bg-safe" />
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                vellum / case_2847.txt
              </div>
            </div>
            <div className="grid gap-0 lg:grid-cols-[2fr,3fr]">
              <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Note excerpt</div>
                <p className="mt-3 font-mono text-xs leading-relaxed text-foreground/80">
                  28 y/o female presents with 3 weeks of daily, bilateral, pressure-type headaches.
                  Reports daily ibuprofen use. No nausea, vomiting, photophobia. No fever.
                  PE unremarkable.
                  <br /><br />
                  <span className="text-muted-foreground">Assessment:</span> Tension-type headache.
                  <br />
                  <span className="text-muted-foreground">Plan:</span> Continue ibuprofen prn. Stress reduction.
                </p>
              </div>
              <div className="space-y-4 p-6">
                <div className="rounded-md border border-critical/30 bg-critical-soft/60 p-4">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-critical">Top Clinical Risk</div>
                  <p className="mt-1 font-display text-base font-semibold text-foreground">
                    Potential missed secondary headache due to absent SNOOP red-flag screening.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[{l:"Safety",v:42,c:"text-critical"},{l:"Reasoning",v:58,c:"text-important"},{l:"Trust",v:51,c:"text-important"}].map(s=>(
                    <div key={s.l} className="rounded-md border border-border bg-surface-muted py-3">
                      <div className={`font-display text-2xl font-semibold ${s.c}`}>{s.v}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-critical-soft text-critical">!</span>
                    <span><span className="font-medium">Premature closure</span> — diagnosis assigned without documenting exclusion of secondary causes.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-important-soft text-important">!</span>
                    <span><span className="font-medium">No medication overuse counseling</span> despite daily analgesic use.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-info-soft text-info">i</span>
                    <span><span className="font-medium">ICHD-3 alignment:</span> Partial — differential breadth missing.</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="capabilities" className="border-t border-border py-20">
          <div className="text-[11px] uppercase tracking-[0.18em] text-accent">What Vellum audits</div>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold lg:text-4xl">
            Ten dimensions of clinical thinking, scored and cited.
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => (
              <div key={c.title} className="paper-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
          Vellum · A clinical reasoning auditor for AI-generated documentation.
        </footer>
      </main>
    </div>
  );
}