import { describe, it, expect } from "vitest";
import { dedupeClaims } from "../dedupe-claims";

describe("dedupeClaims", () => {
  it("collapses 13 duplicated claims spread across note sections to 7 unique entries", () => {
    // Same 7 unique claims, several repeated because the extractor surfaced
    // them in multiple note sections (HPI + Assessment + Plan etc.). The
    // algorithm must dedupe by normalized (claim_type, claim_text).
    // 7 unique claims, repeated across multiple note sections to reach 13 rows.
    const raw = [
      // 1. chest pain (×2)
      { claim_text: "Chest pain radiating to left arm", claim_type: "history", status: "supported", risk_weight: 0.6 },
      { claim_text: "  chest pain radiating to LEFT arm ", claim_type: "history", status: "unsupported", risk_weight: 0.7 },
      // 2. lisinopril (×3 — appears in HPI, medication list, plan)
      { claim_text: "Patient takes lisinopril 10mg daily", claim_type: "medication", status: "unsupported", risk_weight: 0.9 },
      { claim_text: "patient takes lisinopril 10mg daily", claim_type: "medication", status: "contradicted", risk_weight: 0.95 },
      { claim_text: "PATIENT TAKES LISINOPRIL 10mg DAILY", claim_type: "medication", status: "supported", risk_weight: 0.5 },
      // 3. BP (×1)
      { claim_text: "BP 142/88", claim_type: "vital", status: "supported", risk_weight: 0.3 },
      // 4. ACS dx (×2)
      { claim_text: "Diagnosis: acute coronary syndrome", claim_type: "diagnosis", status: "supported", risk_weight: 0.8 },
      { claim_text: "Diagnosis: acute coronary syndrome", claim_type: "diagnosis", status: "uncertain", risk_weight: 0.85 },
      // 5. order troponin (×2)
      { claim_text: "Order troponin", claim_type: "plan", status: "supported", risk_weight: 0.5 },
      { claim_text: "order troponin", claim_type: "plan", status: "supported", risk_weight: 0.5 },
      // 6. penicillin allergy (×1)
      { claim_text: "Penicillin allergy", claim_type: "history", status: "unsupported", risk_weight: 0.95 },
      // 7. ECG ST depression (×2)
      { claim_text: "ECG shows ST depression V4-V6", claim_type: "exam", status: "supported", risk_weight: 0.7 },
      { claim_text: "ECG shows ST depression V4-V6", claim_type: "exam", status: "supported", risk_weight: 0.7 },
    ];
    expect(raw).toHaveLength(13);

    const out = dedupeClaims(raw as any);
    expect(out).toHaveLength(7);

    // Worst status wins on collisions.
    const lisinopril = out.find((c) => c.claim_type === "medication");
    expect(lisinopril?.status).toBe("contradicted");
    expect(lisinopril?.risk_weight).toBe(0.95);

    // Higher risk_weight wins.
    const cp = out.find((c) => c.claim_text.toLowerCase().includes("chest pain"));
    expect(cp?.status).toBe("unsupported");
    expect(cp?.risk_weight).toBe(0.7);

    // Diagnosis: supported < uncertain in our rank.
    const dx = out.find((c) => c.claim_type === "diagnosis");
    expect(dx?.status).toBe("uncertain");
  });

  it("ignores empty claim_text", () => {
    const out = dedupeClaims([
      { claim_text: "", claim_type: "history", status: "supported", risk_weight: 0.1 },
      { claim_text: "   ", claim_type: "history", status: "supported", risk_weight: 0.1 },
      { claim_text: "Real claim", claim_type: "history", status: "supported", risk_weight: 0.1 },
    ] as any);
    expect(out).toHaveLength(1);
  });
});