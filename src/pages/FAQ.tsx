import { Link } from "react-router-dom";
import { useState } from "react";
import { ChevronDown, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    q: "What is Vellum?",
    a: "Vellum is independent clinical AI trust infrastructure. It evaluates AI-generated clinical documentation (scribe notes, summaries, coding suggestions) against the original transcript and EHR evidence. flagging hallucinations, omissions, and unsafe recommendations before they reach a chart.",
  },
  {
    q: "How does the trust score work?",
    a: "Each encounter receives sub-scores for fidelity, completeness, safety, and coding integrity. These roll up into a weighted trust score (0–100). Scoring is calibrated by specialty acuity. a missed allergy in cardiology is weighted differently than a typo in a routine derm visit.",
  },
  {
    q: "What triggers a critical failure?",
    a: "Critical failures include unsupported clinical claims, missing red-flag symptoms, contradicted medications, fabricated lab values, or coding that materially changes reimbursement. Any critical finding routes the encounter to mandatory human review.",
  },
  {
    q: "Is patient data secure?",
    a: "Yes. Vellum is HIPAA-aligned and operates under a BAA with all infrastructure providers. PHI is encrypted in transit and at rest, scoped per organization, and never used to train external models. SOC 2 Type II controls are in effect.",
  },
  {
    q: "Who reviews flagged encounters?",
    a: "Your team's designated clinical reviewers. Vellum routes flagged encounters into a queue with the evidence pre-attached. reviewers see the AI claim, the source span, and the suggested adjudication. Every override is logged.",
  },
  {
    q: "How do I ingest an encounter?",
    a: "From the Encounters page, click 'New Encounter,' paste or upload the transcript and EHR context, set patient and specialty metadata, then run the audit. Results post to the encounter ledger when complete. typically in under a minute.",
  },
  {
    q: "Does Vellum integrate with my EHR or scribe vendor?",
    a: "Yes. Vellum offers FHIR-based integrations with major EHRs and webhook + API integrations with leading AI scribe vendors. Contact us for a vendor-specific integration plan.",
  },
  {
    q: "What audit trail do regulators see?",
    a: "Every evaluation produces an immutable record: model version, evidence spans cited, scores assigned, reviewers assigned, and any overrides. all timestamped and exportable for 21 CFR Part 11 / HIPAA audit requests.",
  },
  {
    q: "How fast does an audit run?",
    a: "Most encounters complete in 20–60 seconds depending on transcript length and the number of agents engaged. Results stream into the encounter ledger as each agent finishes. you don't have to wait for the full pipeline to start reviewing.",
  },
  {
    q: "Can I get team access?",
    a: "Yes. Admins can invite reviewers and assign roles (reviewer, admin, read-only) from Settings → Team. Role-based access controls govern what each user can see and act on.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/auth" className="flex items-center gap-2 group">
            <span className="font-display text-2xl tracking-tight text-foreground">Vellum</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-xs font-heading uppercase tracking-wider text-muted-foreground hover:text-foreground transition">
              <ArrowLeft className="inline h-3 w-3 mr-1" />Back to sign in
            </Link>
            <Link to="/auth">
              <Button className="bg-accent hover:bg-accent-hover text-accent-foreground font-heading uppercase tracking-wider text-xs h-9 rounded-sm">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="mb-12">
          <div className="font-heading text-xs uppercase tracking-[0.22em] text-muted-foreground mb-3">
            Product Walkthrough · Frequently Asked Questions
          </div>
          <h1 className="font-display text-5xl md:text-6xl tracking-tight text-foreground leading-[1.05]">
            See Vellum in motion.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl leading-relaxed">
            A 25-second walkthrough of how Vellum ingests an encounter, audits the AI output, and routes risk to a human reviewer. followed by answers to the questions clinicians ask most.
          </p>
        </div>

        {/* Demo video */}
        <section className="mb-20">
          <div className="relative rounded-sm overflow-hidden border border-border-strong bg-surface shadow-2xl">
            <video
              src="/vellum-demo.mp4"
              controls
              autoPlay
              muted
              loop
              playsInline
              poster=""
              className="w-full aspect-video block bg-background"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-tertiary">
            <ShieldCheck className="h-3 w-3" />
            <span>Synthetic data · No PHI shown</span>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight text-foreground mb-2">
            Frequently asked questions
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Everything reviewers, compliance leads, and clinical informaticists ask before rolling Vellum out.
          </p>

          <div className="border-t border-border">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q} className="border-b border-border">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full py-5 flex items-center justify-between text-left group"
                    aria-expanded={isOpen}
                  >
                    <span className="font-heading text-base md:text-lg text-foreground pr-6 group-hover:text-accent transition">
                      {f.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180 text-accent" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="pb-6 pr-10 text-sm text-muted-foreground leading-relaxed">
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="mt-20 border-t border-border pt-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-2xl text-foreground">Ready to audit your first encounter?</h3>
            <p className="text-sm text-muted-foreground mt-1">Reviewer accounts provision instantly.</p>
          </div>
          <Link to="/auth">
            <Button className="bg-accent hover:bg-accent-hover text-accent-foreground font-heading uppercase tracking-wider text-xs h-10 rounded-sm px-6">
              Open the console
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-border mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-[11px] font-mono uppercase tracking-widest text-tertiary">
          <span>© Vellum</span>
          <div className="flex gap-3">
            <span className="border border-border-strong px-2 py-1">HIPAA</span>
            <span className="border border-border-strong px-2 py-1">SOC 2</span>
            <span className="border border-border-strong px-2 py-1">21 CFR Part 11</span>
          </div>
        </div>
      </footer>
    </div>
  );
}