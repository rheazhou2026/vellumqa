// Pure deduplication used by the evaluate-encounter edge function.
// Mirrored here so unit tests can lock the algorithm behavior down.
// Keep this in sync with `supabase/functions/evaluate-encounter/index.ts`.

export type RawClaim = {
  claim_text: string;
  claim_type: string;
  status?: "supported" | "unsupported" | "contradicted" | "uncertain";
  evidence_quote?: string;
  risk_weight?: number;
};

const STATUS_RANK: Record<string, number> = {
  contradicted: 4,
  unsupported: 3,
  uncertain: 2,
  supported: 1,
};

// Aggressively normalize claim text so the LLM extractor's near-duplicates
// (different sections, trailing punctuation, "Assessment of X" vs "X",
// re-typed as `exam` vs `vital`) collapse into a single ledger row.
function normalizeClaimText(raw: string): string {
  let t = String(raw ?? "").toLowerCase().trim();
  // Collapse whitespace.
  t = t.replace(/\s+/g, " ");
  // Strip trailing punctuation (.,;: and quotes).
  t = t.replace(/[\s.,;:!?"'`]+$/g, "");
  // Strip leading boilerplate prefixes the extractor sometimes adds.
  t = t.replace(/^(assessment of|diagnosis of|impression of|plan to|plan:|note:|patient (is|was) |the patient (is|was) )/i, "").trim();
  return t;
}

export function dedupeClaims<T extends RawClaim>(claims: T[]): T[] {
  const dedupMap = new Map<string, T>();
  for (const c of claims ?? []) {
    const text = normalizeClaimText(c.claim_text);
    if (!text) continue;
    // Key on normalized TEXT only — the extractor occasionally retypes the
    // same statement as `exam` vs `vital` or `assessment` vs `plan`.
    // Collapsing across types prevents the ledger from ballooning to 19 rows
    // when there are really ~7 unique clinical claims.
    const key = text;
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, { ...c });
    } else {
      if ((STATUS_RANK[c.status ?? ""] ?? 0) > (STATUS_RANK[existing.status ?? ""] ?? 0)) {
        existing.status = c.status;
      }
      if ((c.risk_weight ?? 0) > (existing.risk_weight ?? 0)) {
        existing.risk_weight = c.risk_weight;
      }
      if (c.evidence_quote && !existing.evidence_quote) {
        existing.evidence_quote = c.evidence_quote;
      }
    }
  }
  return Array.from(dedupMap.values());
}