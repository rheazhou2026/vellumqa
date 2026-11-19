# Vellum — Evidence-Grounded QA for Clinical AI

**AI governance middleware for oncology documentation.** Vellum is a founder-built prototype for checking AI-generated clinical notes against the underlying encounter transcript, electronic health record (EHR) context, prior visits, and clinical requirements—before a clinician finalizes the record.

**[Website: vellumqa.com](https://vellumqa.com)** · **[Technical pitch deck (Mayo Clinic, June 2026)](https://docs.google.com/presentation/d/1BW-sfBpd7n_6tjgH975ctwAYTujtoZ4ozgCgleP1AX8/edit)** · **[Research collaboration deck (Duke, June 2026)](https://docs.google.com/presentation/d/194p3XWvPkSB1uvSiZF6LIUmapWuogmH-om_wtaI35bY/edit)**

> **Project status and scope:** This repository contains a working full-stack *prototype* with clinical review pages, Supabase-backed evaluation functions, experimental multi-agent components, and demo/benchmark workflows. It is **not a clinically validated medical device**, certified regulatory product, or proof of HIPAA compliance. The research/pitch architecture describes intended deployments; individual features in this repo may require configured services and may not be production hardened. Do not use real patient information in an unapproved environment.

## The problem

Ambient AI scribes make clinical documentation faster, but their output can contain omissions, invented facts, contradictions, and misleadingly plausible reasoning. A readable note is not necessarily a faithful note. Manual verification becomes especially challenging when a draft mixes correct statements with a few consequential errors.

Vellum's thesis is that **clinical AI needs an independent evidence-validation layer, not just another LLM judging whether the note sounds correct**. The system aims to identify specific unsupported or inconsistent claims, point reviewers to the source evidence, and produce a reviewable audit trail. Oncology is the initial vertical because longitudinal history, staging, therapies, lab values, and safety-relevant follow-ups make provenance particularly important.

## How it works

The architecture presented in the Vellum decks is a six-stage evaluation process:

```text
AI-generated note + encounter transcript + EHR/FHIR + prior records
                               |
                [0] Ingest, validate, route
                               |
                [1] Extract atomic claims
                               |
                [2] Normalize terminology
                    SNOMED CT / RxNorm / LOINC
                               |
           [3] Independent parallel cross-checks
             /           |          |          \
       Source        EHR          Clinical      Longitudinal
     faithfulness  consistency   completeness   consistency
             \           |          |          /
                               |
              [4] Escalate flagged/ambiguous
                  cases for deeper reasoning
                               |
             [5] Clinician review and resolution
               evidence | edits | overrides
```

**Why claims, not just a note-level score?** A model can accurately summarize most of an encounter yet invent an allergy, misstate a medication, or omit a treatment-monitoring requirement. Atomic claims make each assertion individually inspectable, attributable, and disputable.

### The four cross-checks

| Agent / check | Compares | Illustrative failure |
|---|---|---|
| **Source faithfulness** | AI note vs. encounter transcript/source | Note says “denies fever”; transcript describes a three-day fever |
| **EHR consistency** | Note vs. medications, allergies, observations, and other available FHIR data | A proposed drug is not represented in the available medication context; requires verification, not automatic rejection |
| **Clinical completeness** | Documentation vs. context-specific clinical requirements | A potentially relevant monitoring result is not recorded |
| **Longitudinal consistency** | Current encounter vs. prior documentation | Previously documented allergy or treatment history omitted or contradicted |

These examples illustrate the product's detection objectives; they are **not validated sensitivity/specificity results**.

## What is implemented in this codebase

The source is a React/TypeScript application backed by Supabase functions and database migrations. The code includes:

- **Clinician review workflows:** encounter queues, encounter detail, findings, source/evidence views, flags, inline note edits, override or feedback actions, final review, and evaluation reports.
- **Evaluation orchestration:** an `agent-orchestrate-evaluation` function and separate functions for routing, claim extraction, terminology normalization, source faithfulness, EHR consistency, clinical completeness, longitudinal consistency, evidence verification, deeper reasoning, risk aggregation, and audit summaries.
- **Structured findings and metrics:** trust-score and audit-oriented UI components, severity/confidence presentation, feedback, audit trails, and clinician-level metrics. The code explicitly treats a completed run as having a `trust_score` and completion timestamp; older individual rubric fields are not guaranteed to be populated.
- **FHIR-oriented integrations:** patient search/fetch, demo-cohort tooling, SMART/FHIR OAuth exchange, and note-writeback related server functions. The app exposes settings/integration interfaces; actual EHR connectivity depends on credentials, scopes, vendor authorization, and environment setup.
- **Vendor QA and benchmarking:** vendor dashboard, test-run pages, run details, public demo view, and benchmark-pack routes.
- **Governance controls:** rubric and guideline views, consent/retention-related components, PHI-purge function, team/settings interfaces, and review/audit surfaces.
- **Presentation media:** a separate Remotion-based video project under `remotion/`.

**Important distinction:** The decks propose a particular hybrid model allocation (small/open models for routing and routine checks, selective frontier-model review of difficult cases, and on-prem options). The repository includes real AI-service calls across several functions, but a successful production deployment of the complete deck architecture—including on-prem inference, terminology coverage, performance, compliance guarantees, and validation—**should not be inferred from the UI or the pitch slides alone**. Some functions are legacy or alternative paths; inspect the active orchestration flow when assessing which run path is exercised.

## Example review scenario

1. An AI scribe drafts an oncology encounter note.
2. The application ingests the note with its available supporting transcript and patient context.
3. The claim extraction stage separates statements about symptoms, medications, diagnoses, labs, and plans.
4. Terminology processing attempts to align relevant phrases with standardized concepts.
5. Cross-checking produces structured evidence-backed findings (supported, unsupported, contradicted, or uncertain), with risk and review context.
6. A clinician examines the flagged assertion, checks evidence, edits the note or records an override, and finalizes their review.

**Illustrative output** (not a result from a validated patient dataset):

```text
Claim:       "Patient denies fever."
Source:      "I have had a fever for three days."
Check:       Source faithfulness
Finding:     Contradiction — requires clinician review
Action:      Review original source and correct/override
```

The purpose is **decision support and reviewability**; findings are not autonomous clinical judgments.

## Architecture and repository map

| Location | Purpose |
|---|---|
| `src/App.tsx` | Front-end routing, protected app shell, legacy redirects |
| `src/pages/oncology/` | Clinician review queue, review detail, final review, guidelines |
| `src/pages/vendor/` | Vendor testing and audit-run UI |
| `src/pages/app/` | Reporting, team, integration and settings screens; some legacy pages |
| `src/components/vellum/` | Evidence traces, issue cards, trust-score UI, overrides, rubric and governance components |
| `src/lib/` | Evaluation helpers, findings, deduplication, clinician metrics and tests |
| `src/integrations/supabase/` | Typed Supabase browser client |
| `supabase/functions/` | Deno edge functions for multi-stage evaluation and integrations |
| `supabase/migrations/` | Database schema and policy evolution |
| `src/test/` and `src/lib/__tests__/` | Vitest test setup and focused tests |
| `remotion/` | Standalone product-video source |

### Technology stack

- **Frontend:** Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui/Radix UI, React Router.
- **State and data:** TanStack Query, Supabase client, Postgres-backed Supabase services.
- **Backend:** Supabase Deno Edge Functions; model-API integrations, clinical evaluation orchestration, FHIR-adjacent endpoints.
- **Visualization/reports:** Recharts, PDF tooling, interactive reviewer interfaces.
- **Developer tooling:** npm/Bun lockfiles, ESLint, Vitest, Playwright; Remotion video workspace.

## Run locally

**Prerequisites:** Node.js and npm; access to an appropriately configured Supabase project and any external AI/EHR services you intend to exercise. A frontend-only launch does not imply that hosted backend evaluation functions will work.

```bash
# From the repository root
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```bash
npm run build
npm run preview
```

Run the included test suites and lint checks:

```bash
npm test
npm run lint
npm run test:e2e:install
npm run test:e2e
```

The Playwright suite requires a suitable runtime/browser environment and may depend on configured test fixtures or services. Passing the included tests is **not** medical, security, or clinical validation.

### Environment configuration

The browser client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Configure these using **your own project's** authorized settings. Server-only integrations can require separate Supabase Edge Function secrets (for example model API keys or a service-role key); configure them server-side, **never** as `VITE_` variables or committed files.

```dotenv
# .env.local — placeholders only
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

**Security check before publishing:** the supplied project archive included an `.env` file and a `.gitignore` that did **not** explicitly ignore `.env`. Do **not** publish the archive unchanged. Add `.env`, `.env.*`, and `!.env.example` to `.gitignore`; inspect Git history for leaked values and rotate any credentials that were exposed. Supabase service-role credentials, EHR client secrets, PHI, and API keys must never be committed. Public publishable keys are different from private credentials, but still review all environment values.

## Design decisions and research directions

**Evidence-backed auditing over fluency scoring.** The primary question is whether a statement is justified by independent sources—not whether it reads smoothly. Evidence pointers and explicit uncertainty help humans challenge mistakes.

**Selective reasoning.** The proposed design reserves more expensive reasoning for clinically relevant, contradictory, or ambiguous cases rather than applying the same heavyweight model to every claim. This is a hypothesis about efficiency and accuracy that still requires measured benchmarks.

**Vertical clinical context.** Oncology-specific evaluation can use longitudinal medications, biomarkers, staging, therapy histories, and safety requirements in ways a generic note grader cannot.

**Human control and governance.** Flag resolution, note edits, documented overrides, audit trails, and retention choices are integral to the workflow rather than afterthoughts.

### Proposed research pilot — not completed validation

The Duke collaboration deck proposes a **90-day study concept**: pair *appropriately de-identified* AI-scribe oncology notes with reference clinical documentation, run automated checks, have clinical experts adjudicate findings, classify error types by severity and potential downstream decision impact, and publish a shared oncology-specific evaluation taxonomy/benchmark. This is a research proposal, not a statement that a partner institution participated or that the study was completed.

Useful future evaluation measures include claim-level precision/recall against adjudicated labels, clinically weighted false negatives, inter-rater agreement, review-time reduction, audit reproducibility, cross-site generalization, and performance by note type/cancer context. No such results are claimed here.

## Limitations and responsible use

- **Not for autonomous diagnosis or treatment.** A flagged or unflagged note does not establish clinical correctness.
- **Evidence may be incomplete.** Missing EHR data or an unavailable transcript is not proof a documented claim is false.
- **AI evaluators can also hallucinate.** A second model is not independent ground truth; clinician adjudication and controlled studies remain essential.
- **Models and terminology coverage vary.** Model versions, API availability, terminology licenses, and deployed integrations must be verified per environment.
- **Privacy/security require deployment-specific verification.** PHI retention options and HIPAA-conscious architecture are design goals, not a representation of a signed BAA, security audit, or regulatory certification.
- **Demo/benchmark flows may use synthetic or test data.** Do not assume that examples are validated against real clinical outcomes.

## Research and presentation materials

- [Vellum — Mayo Clinic presentation (June 23, 2026)](https://docs.google.com/presentation/d/1BW-sfBpd7n_6tjgH975ctwAYTujtoZ4ozgCgleP1AX8/edit)
- [Vellum — MD Anderson presentation (June 16, 2026)](https://docs.google.com/presentation/d/1BA3xLwindAHOuEsgqW1_u_y7w-uutjs8iCxszx9vw9Q/edit)
- [Vellum — Duke research collaboration presentation (June 19, 2026)](https://docs.google.com/presentation/d/194p3XWvPkSB1uvSiZF6LIUmapWuogmH-om_wtaI35bY/edit)

The decks communicate the product thesis, proposed technical architecture, and collaboration concept. External clinical-study figures or market numbers within those decks should be independently rechecked before being quoted as established facts.

## Founder

**Rhea Zhou** · Jerome Fisher Program in Management & Technology (M&T), University of Pennsylvania, Class of 2030.

Vellum is an independent, early-stage healthcare AI quality and governance project. References to hospitals and vendors describe a problem space or presentation context and **do not imply endorsement, deployment, affiliation, or a formal research partnership**.
