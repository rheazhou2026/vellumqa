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

export function dedupeClaims<T extends RawClaim>(claims: T[]): T[] {
  const dedupMap = new Map<string, T>();
  for (const c of claims ?? []) {
    const text = String(c.claim_text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const type = String(c.claim_type ?? "").trim().toLowerCase();
    if (!text) continue;
    const key = `${type}::${text}`;
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