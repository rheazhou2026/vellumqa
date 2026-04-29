import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const JURISDICTIONS = [
  { value: "US_FEDERAL", label: "US Federal" },
  { value: "US_CA", label: "California" },
  { value: "US_NY", label: "New York" },
  { value: "US_TX", label: "Texas" },
  { value: "US_FL", label: "Florida" },
  { value: "OTHER", label: "Other" },
] as const;

const GUIDELINE_STACK = [
  { value: "AHA_CP", label: "AHA_CP", description: "AHA chest-pain pathway" },
  { value: "ED_SEP", label: "ED_SEP", description: "ED sepsis bundle" },
  { value: "APA_SRA", label: "APA_SRA", description: "APA suicide-risk assessment" },
  { value: "ADA_SOC", label: "ADA_SOC", description: "ADA standards of care" },
  { value: "NCCN_FN", label: "NCCN_FN", description: "NCCN febrile neutropenia" },
  { value: "AAP_FI", label: "AAP_FI", description: "AAP febrile infant" },
] as const;

const settingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Organization name cannot be empty")
    .max(120, "Organization name must be 120 characters or fewer"),
  jurisdiction: z.enum([
    "US_FEDERAL",
    "US_CA",
    "US_NY",
    "US_TX",
    "US_FL",
    "OTHER",
  ]),
  state_jurisdiction: z
    .string()
    .trim()
    .max(80, "State / region must be 80 characters or fewer")
    .nullable(),
  guideline_stack: z.array(z.string()).max(20),
  escalation_threshold: z.number().int().min(0).max(100),
});

type FormState = z.infer<typeof settingsSchema>;

const DEFAULT_STATE: FormState = {
  name: "",
  jurisdiction: "US_FEDERAL",
  state_jurisdiction: null,
  guideline_stack: ["AHA_CP", "ED_SEP"],
  escalation_threshold: 60,
};

export default function Settings() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    void loadOrg();
  }, []);

  async function loadOrg() {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) {
        toast.error("You must be signed in to manage organization settings.");
        return;
      }

      // Resolve the user's organization. Prefer vellum_users, else most-recent
      // encounter, else the most-recent organization row (single-tenant fallback).
      let resolvedId: string | null = null;

      const { data: vu } = await supabase
        .from("vellum_users")
        .select("organization_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (vu?.organization_id) resolvedId = vu.organization_id;

      if (!resolvedId) {
        const { data: enc } = await supabase
          .from("encounters")
          .select("organization_id")
          .eq("user_id", userId)
          .not("organization_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (enc?.organization_id) resolvedId = enc.organization_id;
      }

      if (!resolvedId) {
        const { data: anyOrg } = await supabase
          .from("organizations")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (anyOrg?.id) resolvedId = anyOrg.id;
      }

      if (!resolvedId) {
        setOrgId(null);
        return;
      }

      const { data: org, error } = await supabase
        .from("organizations")
        .select("id,name,jurisdiction,state_jurisdiction,guideline_profile,compliance_settings")
        .eq("id", resolvedId)
        .maybeSingle();
      if (error) throw error;
      if (!org) {
        setOrgId(null);
        return;
      }

      setOrgId(org.id);
      const profile = (org.guideline_profile ?? {}) as Record<string, unknown>;
      const compliance = (org.compliance_settings ?? {}) as Record<string, unknown>;
      const stack = Array.isArray(profile.guideline_stack)
        ? (profile.guideline_stack as string[]).filter((g) =>
            GUIDELINE_STACK.some((opt) => opt.value === g),
          )
        : DEFAULT_STATE.guideline_stack;
      const threshold =
        typeof compliance.escalation_threshold === "number"
          ? Math.max(0, Math.min(100, Math.round(compliance.escalation_threshold)))
          : DEFAULT_STATE.escalation_threshold;
      const j = (org.jurisdiction ?? "US_FEDERAL") as FormState["jurisdiction"];
      setForm({
        name: org.name ?? "",
        jurisdiction: JURISDICTIONS.some((x) => x.value === j) ? j : "OTHER",
        state_jurisdiction: org.state_jurisdiction ?? null,
        guideline_stack: stack,
        escalation_threshold: threshold,
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load organization settings.");
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleGuideline(value: string, checked: boolean) {
    setForm((prev) => {
      const next = checked
        ? Array.from(new Set([...prev.guideline_stack, value]))
        : prev.guideline_stack.filter((g) => g !== value);
      return { ...prev, guideline_stack: next };
    });
  }

  async function save() {
    const parsed = settingsSchema.safeParse({
      ...form,
      // when jurisdiction is not OTHER, drop the free-text region.
      state_jurisdiction:
        form.jurisdiction === "OTHER" ? form.state_jurisdiction?.trim() || null : null,
    });
    if (!parsed.success) {
      const flat: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormState;
        if (k && !flat[k]) flat[k] = issue.message;
      }
      setErrors(flat);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (!orgId) {
      toast.error("No organization linked to this account yet.");
      return;
    }

    setSaving(true);
    try {
      const payload = parsed.data;
      const { error } = await supabase
        .from("organizations")
        .update({
          name: payload.name,
          jurisdiction: payload.jurisdiction,
          state_jurisdiction: payload.state_jurisdiction,
          guideline_profile: { guideline_stack: payload.guideline_stack },
          compliance_settings: { escalation_threshold: payload.escalation_threshold },
        })
        .eq("id", orgId);
      if (error) throw error;
      toast.success("Organization settings saved.");
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.includes("row-level security")
        ? "You need admin permissions to update organization settings."
        : e?.message ?? "Save failed.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const showOtherInput = form.jurisdiction === "OTHER";
  const stackSummary = useMemo(
    () => (form.guideline_stack.length ? form.guideline_stack.join(" · ") : "none selected"),
    [form.guideline_stack],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Console / Settings"
        title="Organization"
        description="Org details, jurisdiction, team roles, and integrations."
      />
      <div className="p-6 grid lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 vellum-panel p-5 space-y-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
            Organization profile
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading organization…
            </div>
          ) : !orgId ? (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-sm p-4">
              No organization is linked to this account yet. Create your first encounter and an
              admin will provision the org record.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  value={form.name}
                  maxLength={120}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="St. Vellum Health System"
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="text-[11px] text-critical">{errors.name}</p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="jurisdiction">Jurisdiction</Label>
                  <Select
                    value={form.jurisdiction}
                    onValueChange={(v) => update("jurisdiction", v as FormState["jurisdiction"])}
                  >
                    <SelectTrigger id="jurisdiction">
                      <SelectValue placeholder="Select jurisdiction" />
                    </SelectTrigger>
                    <SelectContent>
                      {JURISDICTIONS.map((j) => (
                        <SelectItem key={j.value} value={j.value}>
                          {j.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showOtherInput && (
                  <div className="space-y-1.5">
                    <Label htmlFor="state-jur">State / region</Label>
                    <Input
                      id="state-jur"
                      value={form.state_jurisdiction ?? ""}
                      maxLength={80}
                      onChange={(e) => update("state_jurisdiction", e.target.value)}
                      placeholder="e.g. Ontario, CA"
                      aria-invalid={!!errors.state_jurisdiction}
                    />
                    {errors.state_jurisdiction && (
                      <p className="text-[11px] text-critical">{errors.state_jurisdiction}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Default guideline stack</Label>
                <p className="text-[11px] text-muted-foreground">
                  Modules the rubric loader will consider before chief-complaint scoping.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {GUIDELINE_STACK.map((g) => {
                    const checked = form.guideline_stack.includes(g.value);
                    return (
                      <label
                        key={g.value}
                        className={`flex items-start gap-2 border rounded-sm p-2 cursor-pointer transition ${
                          checked
                            ? "border-accent/60 bg-accent/5"
                            : "border-border bg-surface hover:border-muted-foreground/40"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => toggleGuideline(g.value, c === true)}
                          aria-label={g.label}
                        />
                        <div className="min-w-0">
                          <div className="font-mono text-[11px]">{g.label}</div>
                          <div className="text-[10px] text-muted-foreground">{g.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] font-mono text-tertiary">selected: {stackSummary}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="threshold">
                    Escalate encounters with Trust Score below X
                  </Label>
                  <span className="font-display text-xl">
                    {form.escalation_threshold}
                  </span>
                </div>
                <Slider
                  id="threshold"
                  min={0}
                  max={100}
                  step={1}
                  value={[form.escalation_threshold]}
                  onValueChange={(v) => update("escalation_threshold", v[0] ?? 60)}
                />
                <div className="flex justify-between text-[10px] font-mono text-tertiary">
                  <span>0 · never escalate</span>
                  <span>100 · escalate everything</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  onClick={save}
                  disabled={saving}
                  className="bg-accent text-accent-foreground hover:bg-accent-hover"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save settings
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </section>

        <div className="space-y-4">
          <Link
            to="/settings/team"
            className="block vellum-panel p-4 hover:border-accent/50 transition group"
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
              Configured
            </div>
            <div className="flex items-center justify-between mt-1">
              <h3 className="font-display text-base">Team</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Invite members and assign Clinician / QA Reviewer / Compliance / Governance / Admin roles.
            </p>
          </Link>
          <Link
            to="/settings/integrations"
            className="block vellum-panel p-4 hover:border-accent/50 transition group"
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
              Configured
            </div>
            <div className="flex items-center justify-between mt-1">
              <h3 className="font-display text-base">Integrations</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              AI vendor webhook URL, EHR/FHIR connection, edge function endpoint.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}