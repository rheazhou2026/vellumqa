import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";

// Use bundled default fonts (Helvetica) for maximum compatibility; we register
// a monospace fallback for IDs/quotes.
Font.registerHyphenationCallback((w) => [w]);

const C = {
  ink: "#0A0C0F",
  body: "#1F2433",
  muted: "#5A6172",
  faint: "#8A92A2",
  rule: "#D8DCE6",
  surface: "#F5F6F9",
  accent: "#3849B5",
  pass: "#1F7A55",
  moderate: "#A8771C",
  high: "#B83A2A",
  critical: "#7A1717",
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: C.body, fontFamily: "Helvetica" },
  brand: { fontSize: 9, letterSpacing: 2, color: C.accent, marginBottom: 4 },
  h1: { fontSize: 22, color: C.ink, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: C.muted, marginBottom: 18 },
  rule: { borderBottomWidth: 1, borderBottomColor: C.rule, marginVertical: 14 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  bigScore: { fontSize: 60, fontFamily: "Helvetica-Bold", color: C.ink, lineHeight: 1 },
  scoreLabel: { fontSize: 8, color: C.faint, letterSpacing: 1.5, textTransform: "uppercase" },
  pill: { fontSize: 8, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 2, color: "#fff" },
  sectionTitle: { fontSize: 9, color: C.faint, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, fontFamily: "Helvetica-Bold" },
  card: { borderWidth: 1, borderColor: C.rule, padding: 10, marginBottom: 6, borderRadius: 2 },
  cardTitle: { fontSize: 10, color: C.ink, marginBottom: 3, fontFamily: "Helvetica-Bold" },
  cardBody: { fontSize: 9, color: C.body, lineHeight: 1.4 },
  quote: { fontSize: 8.5, color: C.muted, fontStyle: "italic", marginTop: 4, paddingLeft: 6, borderLeftWidth: 2, borderLeftColor: C.accent },
  meta2col: { flexDirection: "row", flexWrap: "wrap" },
  metaCell: { width: "33.33%", marginBottom: 6 },
  metaLabel: { fontSize: 7.5, color: C.faint, letterSpacing: 1, textTransform: "uppercase", marginBottom: 1 },
  metaValue: { fontSize: 9, color: C.body, fontFamily: "Courier" },
  subscoreGrid: { flexDirection: "row", flexWrap: "wrap" },
  subscore: { width: "33.33%", padding: 6, borderWidth: 0.5, borderColor: C.rule },
  subscoreLabel: { fontSize: 7.5, color: C.faint, textTransform: "uppercase", letterSpacing: 1 },
  subscoreVal: { fontSize: 18, color: C.ink, marginTop: 2, fontFamily: "Helvetica-Bold" },
  badge: { fontSize: 7.5, paddingVertical: 2, paddingHorizontal: 5, borderRadius: 2, color: "#fff", marginLeft: 6 },
  bullet: { fontSize: 9, marginBottom: 3, color: C.body },
  footer: { position: "absolute", bottom: 18, left: 40, right: 40, fontSize: 7.5, color: C.faint, flexDirection: "row", justifyContent: "space-between" },
  pageNum: { fontSize: 7.5, color: C.faint },
  twoCol: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  splitHeader: { fontSize: 8.5, color: C.muted, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  evidenceRow: { flexDirection: "row", marginBottom: 8 },
  evidenceLeft: { flex: 1, paddingRight: 8 },
  evidenceRight: { flex: 1, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: C.rule },
  table: { borderWidth: 1, borderColor: C.rule },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.rule },
  th: { fontSize: 7.5, color: C.faint, textTransform: "uppercase", letterSpacing: 1, padding: 5, fontFamily: "Helvetica-Bold" },
  td: { fontSize: 8.5, padding: 5, color: C.body },
});

function severityColor(sev?: string): string {
  switch (sev) {
    case "critical": return C.critical;
    case "high": return C.high;
    case "moderate": return C.moderate;
    case "low": return C.pass;
    default: return C.muted;
  }
}
function trustColor(score?: number | null): string {
  if (score == null) return C.muted;
  if (score >= 85) return C.pass;
  if (score >= 70) return C.moderate;
  if (score >= 55) return C.high;
  return C.critical;
}
function trustLabel(score?: number | null): string {
  if (score == null) return "PENDING";
  if (score >= 85) return "TRUSTED";
  if (score >= 70) return "CAUTION";
  if (score >= 55) return "AT RISK";
  return "UNSAFE";
}

export interface EvaluationPdfData {
  encounter: any;
  run: any;
  results: any[];
  claims: any[];
  criteriaByCriterionId: Record<string, { name: string; domain_id?: string }>;
  domains: Record<string, string>;
  analytics?: { vendor: string; avg: number; runs: number; criticalRate: number }[];
}

function Header({ d }: { d: EvaluationPdfData }) {
  return (
    <View>
      <Text style={s.brand}>VELLUM · CLINICAL AI AUDIT PACK</Text>
      <Text style={s.h1}>{d.encounter?.chief_complaint ?? "Encounter audit"}</Text>
      <Text style={s.meta}>
        {(d.encounter?.specialty ?? "—").replace(/_/g, " ")} ·{" "}
        {d.encounter?.visit_type ?? "—"} · {d.encounter?.ai_vendor ?? "unknown vendor"} ·{" "}
        encounter {String(d.encounter?.id ?? "").slice(0, 8)}
      </Text>
    </View>
  );
}

function Footer({ runId }: { runId?: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>Vellum audit pack · run {String(runId ?? "").slice(0, 8) || "—"} · generated {new Date().toISOString().slice(0, 19).replace("T", " ")}Z</Text>
      <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function EvaluationPdf({ data }: { data: EvaluationPdfData }) {
  const { encounter, run, results, claims, criteriaByCriterionId, domains, analytics } = data;

  const subScores: [string, number | null | undefined][] = [
    ["Source faithfulness", run?.source_faithfulness_index],
    ["Differential integrity", run?.differential_integrity_score],
    ["Guideline concordance", run?.guideline_concordance_score],
    ["Omission hazard", run?.omission_hazard_score],
    ["Patient-safety escalation", run?.patient_safety_escalation_score],
    ["Uncertainty calibration", run?.uncertainty_calibration_score],
    ["Medico-legal exposure", run?.medico_legal_exposure_score],
    ["Reviewability", run?.reviewability_index],
    ["Evaluator confidence", run?.evaluator_confidence],
  ];

  const grouped = new Map<string, any[]>();
  for (const r of results) {
    const dk = criteriaByCriterionId[r.criterion_id]?.domain_id ?? "ungrouped";
    if (!grouped.has(dk)) grouped.set(dk, []);
    grouped.get(dk)!.push(r);
  }

  return (
    <Document title={`Vellum Audit · ${encounter?.id?.slice(0, 8) ?? ""}`}>
      {/* PAGE 1 — Executive */}
      <Page size="LETTER" style={s.page}>
        <Header d={data} />

        <View style={s.scoreRow}>
          <View>
            <Text style={s.scoreLabel}>Trust score · 0–100</Text>
            <Text style={[s.bigScore, { color: trustColor(run?.trust_score) }]}>
              {run?.trust_score != null ? Math.round(run.trust_score) : "—"}
            </Text>
          </View>
          <View style={[s.pill, { backgroundColor: trustColor(run?.trust_score) }]}>
            <Text>{trustLabel(run?.trust_score)}</Text>
          </View>
        </View>

        <View style={s.rule} />

        {run?.critical_failures?.length > 0 && (
          <View style={[s.card, { borderColor: C.critical, backgroundColor: "#FBEDEA" }]}>
            <Text style={[s.cardTitle, { color: C.critical }]}>
              Critical failures · {run.critical_failures.length}
            </Text>
            {run.critical_failures.map((f: string, i: number) => (
              <Text key={i} style={s.bullet}>· {f}</Text>
            ))}
          </View>
        )}

        <Text style={[s.sectionTitle, { marginTop: 12 }]}>Domain sub-scores</Text>
        <View style={s.subscoreGrid}>
          {subScores.map(([label, val]) => (
            <View key={label} style={s.subscore}>
              <Text style={s.subscoreLabel}>{label}</Text>
              <Text style={s.subscoreVal}>{val != null ? Math.round(val * 10) / 10 : "—"}</Text>
            </View>
          ))}
        </View>

        <View style={s.rule} />

        <Text style={s.sectionTitle}>Audit trace</Text>
        <View style={s.meta2col}>
          {[
            ["encounter_id", encounter?.id],
            ["artifact_id", run?.artifact_id ?? "—"],
            ["run_id", run?.id ?? "—"],
            ["completed_at", run?.completed_at ?? "—"],
            ["ai_vendor", encounter?.ai_vendor ?? "—"],
            ["specialty", encounter?.specialty ?? "—"],
          ].map(([k, v]) => (
            <View key={k as string} style={s.metaCell}>
              <Text style={s.metaLabel}>{k as string}</Text>
              <Text style={s.metaValue}>{String(v ?? "—")}</Text>
            </View>
          ))}
        </View>
        <Footer runId={run?.id} />
      </Page>

      {/* PAGE 2 — Reasoning */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.brand}>02 · CLINICAL REASONING</Text>
        <Text style={s.h1}>Reasoning quality</Text>
        <View style={[s.pill, { backgroundColor: C.accent, alignSelf: "flex-start", marginBottom: 10 }]}>
          <Text>{(run?.reasoning_quality ?? "—").toString().toUpperCase()}</Text>
        </View>
        {run?.reasoning_summary && (
          <Text style={[s.cardBody, { marginBottom: 12 }]}>{run.reasoning_summary}</Text>
        )}

        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={[s.splitHeader, { color: C.pass }]}>STRENGTHS · {run?.reasoning_strengths?.length ?? 0}</Text>
            {(run?.reasoning_strengths ?? []).map((it: any, i: number) => (
              <View key={i} style={[s.card, { borderLeftWidth: 3, borderLeftColor: C.pass }]}>
                <Text style={s.cardTitle}>{it.title}</Text>
                <Text style={s.cardBody}>{it.detail}</Text>
                {it.evidence_quote && <Text style={s.quote}>"{it.evidence_quote}"</Text>}
              </View>
            ))}
            {!run?.reasoning_strengths?.length && <Text style={s.bullet}>None identified.</Text>}
          </View>
          <View style={s.col}>
            <Text style={[s.splitHeader, { color: C.high }]}>GAPS · {run?.reasoning_gaps?.length ?? 0}</Text>
            {(run?.reasoning_gaps ?? []).map((it: any, i: number) => (
              <View key={i} style={[s.card, { borderLeftWidth: 3, borderLeftColor: severityColor(it.severity) }]}>
                <Text style={s.cardTitle}>{it.title}</Text>
                <Text style={s.cardBody}>{it.detail}</Text>
                {it.suggestion && <Text style={[s.cardBody, { color: C.accent, marginTop: 3 }]}>→ {it.suggestion}</Text>}
                {it.evidence_quote && <Text style={s.quote}>"{it.evidence_quote}"</Text>}
              </View>
            ))}
            {!run?.reasoning_gaps?.length && <Text style={s.bullet}>No gaps detected.</Text>}
          </View>
        </View>
        <Footer runId={run?.id} />
      </Page>

      {/* PAGE 3 — Guidelines + Red Flags */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.brand}>03 · GUIDELINE-AWARE QA</Text>
        <Text style={s.h1}>Guideline cross-references</Text>
        {(run?.guideline_matches ?? []).map((m: any, i: number) => (
          <View key={i} style={[s.card, { borderLeftWidth: 3, borderLeftColor: severityColor(m.status === "missing" ? "high" : m.status === "contradicted" ? "critical" : m.status === "partial" ? "moderate" : "low") }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[s.cardTitle, { flex: 1 }]}>{m.recommendation}</Text>
              <Text style={[s.metaLabel, { marginLeft: 8 }]}>{(m.status ?? "").toUpperCase()}</Text>
            </View>
            {m.guideline && <Text style={[s.metaValue, { marginVertical: 2 }]}>{m.guideline}</Text>}
            {m.suggestion && <Text style={[s.cardBody, { color: C.accent }]}>→ {m.suggestion}</Text>}
            {m.evidence_quote && <Text style={s.quote}>"{m.evidence_quote}"</Text>}
          </View>
        ))}
        {!(run?.guideline_matches?.length) && <Text style={s.bullet}>No guideline cross-references generated.</Text>}

        <Text style={[s.sectionTitle, { marginTop: 14 }]}>Missed red flags</Text>
        {(run?.red_flag_findings ?? []).filter((f: any) => f.status === "missed").map((f: any, i: number) => (
          <View key={i} style={[s.card, { borderLeftWidth: 3, borderLeftColor: C.critical }]}>
            <Text style={[s.cardTitle, { color: C.critical }]}>{f.label}</Text>
            <Text style={s.cardBody}>Why it matters: {f.why_it_matters}</Text>
            {f.suggested_addition && (
              <Text style={[s.cardBody, { color: C.accent, marginTop: 3 }]}>→ Add to note: "{f.suggested_addition}"</Text>
            )}
          </View>
        ))}
        {!(run?.red_flag_findings ?? []).some((f: any) => f.status === "missed") && (
          <Text style={s.bullet}>No missed red flags.</Text>
        )}
        <Footer runId={run?.id} />
      </Page>

      {/* PAGE 4 — Cognitive bias */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.brand}>04 · COGNITIVE BIAS DETECTION</Text>
        <Text style={s.h1}>Detected reasoning biases</Text>
        {(run?.cognitive_biases ?? []).map((b: any, i: number) => (
          <View key={i} style={[s.card, { borderLeftWidth: 3, borderLeftColor: C.high }]}>
            <Text style={s.cardTitle}>{b.bias?.replace(/_/g, " ")?.toUpperCase() ?? "BIAS"}</Text>
            <Text style={s.cardBody}>{b.explanation}</Text>
            {b.remediation && <Text style={[s.cardBody, { color: C.accent, marginTop: 3 }]}>→ {b.remediation}</Text>}
            {b.evidence_quote && <Text style={s.quote}>"{b.evidence_quote}"</Text>}
          </View>
        ))}
        {!run?.cognitive_biases?.length && <Text style={s.bullet}>No biases detected.</Text>}
        <Footer runId={run?.id} />
      </Page>

      {/* PAGE 5 — Findings table */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.brand}>05 · CRITERION FINDINGS</Text>
        <Text style={s.h1}>All evaluated criteria · {results.length}</Text>
        {[...grouped.entries()].map(([dom, items]) => (
          <View key={dom} wrap={false} style={{ marginBottom: 10 }}>
            <Text style={[s.splitHeader, { marginTop: 6 }]}>
              Domain · {domains[dom] ?? dom.slice(0, 8)}
            </Text>
            {items.map((r) => (
              <View key={r.id} style={[s.card, { borderLeftWidth: 3, borderLeftColor: severityColor(r.severity) }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[s.cardTitle, { flex: 1 }]}>{criteriaByCriterionId[r.criterion_id]?.name ?? r.criterion_id}</Text>
                  <Text style={[s.metaLabel, { marginLeft: 8 }]}>{(r.result ?? "").toUpperCase()}</Text>
                </View>
                <Text style={s.cardBody}>{r.explanation}</Text>
                {r.evidence?.quote && <Text style={s.quote}>"{r.evidence.quote}"</Text>}
              </View>
            ))}
          </View>
        ))}
        <Footer runId={run?.id} />
      </Page>

      {/* PAGE 6 — Analytics snapshot + claim ledger */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.brand}>06 · ANALYTICS SNAPSHOT</Text>
        <Text style={s.h1}>Vendor reliability context</Text>
        {analytics && analytics.length > 0 ? (
          <View style={s.table}>
            <View style={[s.tr, { backgroundColor: C.surface }]}>
              <Text style={[s.th, { flex: 2 }]}>Vendor</Text>
              <Text style={[s.th, { flex: 1 }]}>Runs</Text>
              <Text style={[s.th, { flex: 1 }]}>Avg trust</Text>
              <Text style={[s.th, { flex: 1 }]}>Critical rate</Text>
            </View>
            {analytics.map((a) => (
              <View key={a.vendor} style={s.tr}>
                <Text style={[s.td, { flex: 2 }]}>{a.vendor}</Text>
                <Text style={[s.td, { flex: 1 }]}>{a.runs}</Text>
                <Text style={[s.td, { flex: 1, color: trustColor(a.avg) }]}>{a.avg.toFixed(1)}</Text>
                <Text style={[s.td, { flex: 1 }]}>{(a.criticalRate * 100).toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.bullet}>Not enough historical data for analytics snapshot.</Text>
        )}

        <Text style={[s.sectionTitle, { marginTop: 18 }]}>Clinical claim ledger · {claims.length}</Text>
        <View style={s.table}>
          <View style={[s.tr, { backgroundColor: C.surface }]}>
            <Text style={[s.th, { flex: 4 }]}>Claim</Text>
            <Text style={[s.th, { flex: 1 }]}>Type</Text>
            <Text style={[s.th, { flex: 1 }]}>Status</Text>
          </View>
          {claims.map((c) => (
            <View key={c.id} style={s.tr}>
              <Text style={[s.td, { flex: 4 }]}>{c.claim_text}</Text>
              <Text style={[s.td, { flex: 1 }]}>{c.claim_type}</Text>
              <Text style={[s.td, { flex: 1, color: c.status === "supported" ? C.pass : c.status === "contradicted" ? C.critical : C.high }]}>
                {c.status}
              </Text>
            </View>
          ))}
          {!claims.length && (
            <View style={s.tr}>
              <Text style={[s.td, { flex: 6, color: C.muted }]}>No claims extracted.</Text>
            </View>
          )}
        </View>
        <Footer runId={run?.id} />
      </Page>
    </Document>
  );
}

export async function downloadEvaluationPdf(data: EvaluationPdfData) {
  const blob = await pdf(<EvaluationPdf data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vellum-audit-${String(data.encounter?.id ?? "").slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}