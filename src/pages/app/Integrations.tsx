import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Copy,
  Check,
  PlugZap,
  Activity,
  Webhook,
  Database,
  ArrowLeft,
} from "lucide-react";

import PageHeader from "@/components/vellum/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const urlSchema = z
  .string()
  .trim()
  .url("Must be a valid https:// URL")
  .max(2048, "URL too long");

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://xzpwdvxkluavegayhrxi.supabase.co";
const EVALUATE_ENDPOINT = `${SUPABASE_URL}/functions/v1/evaluate-encounter`;

type WorkflowMeta = {
  ai_vendor_webhook_url?: string | null;
  fhir?: { base_url?: string | null; api_key?: string | null } | null;
};

function StatusDot({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest">
      <span
        className={`h-2 w-2 rounded-full ${
          ok ? "bg-emerald-500 shadow-[0_0_8px_hsl(var(--accent)/0.5)]" : "bg-muted-foreground/40"
        }`}
        aria-hidden
      />
      <span className={ok ? "text-emerald-500" : "text-muted-foreground"}>
        {label ?? (ok ? "Connected" : "Not configured")}
      </span>
    </span>
  );
}

export default function Integrations() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [savingFhir, setSavingFhir] = useState(false);
  const [testingFhir, setTestingFhir] = useState(false);
  const [copied, setCopied] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [savedWebhookUrl, setSavedWebhookUrl] = useState("");

  const [fhirUrl, setFhirUrl] = useState("");
  const [fhirKey, setFhirKey] = useState("");
  const [savedFhirUrl, setSavedFhirUrl] = useState("");
  const [savedFhirKey, setSavedFhirKey] = useState("");
  const [fhirTestResult, setFhirTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) {
        toast.error("Sign in to manage integrations.");
        return;
      }

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
        .select("id, compliance_settings")
        .eq("id", resolvedId)
        .maybeSingle();
      if (error) throw error;

      setOrgId(org?.id ?? null);
      const meta = ((org?.compliance_settings ?? {}) as Record<string, unknown>)
        .integrations as WorkflowMeta | undefined;
      const webhook = meta?.ai_vendor_webhook_url ?? "";
      const fb = meta?.fhir?.base_url ?? "";
      const fk = meta?.fhir?.api_key ?? "";
      setWebhookUrl(webhook);
      setSavedWebhookUrl(webhook);
      setFhirUrl(fb);
      setSavedFhirUrl(fb);
      setFhirKey(fk);
      setSavedFhirKey(fk);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load integration settings.");
    } finally {
      setLoading(false);
    }
  }

  async function persistIntegrations(next: WorkflowMeta) {
    if (!orgId) throw new Error("No organization linked to this account.");
    const { data: existing, error: readErr } = await supabase
      .from("organizations")
      .select("compliance_settings")
      .eq("id", orgId)
      .maybeSingle();
    if (readErr) throw readErr;
    const current = (existing?.compliance_settings ?? {}) as Record<string, unknown>;
    const currentIntegrations = (current.integrations ?? {}) as WorkflowMeta;
    const merged = {
      ...current,
      integrations: {
        ...currentIntegrations,
        ...next,
        fhir: { ...(currentIntegrations.fhir ?? {}), ...(next.fhir ?? {}) },
      },
    };
    const { error } = await supabase
      .from("organizations")
      .update({ compliance_settings: merged })
      .eq("id", orgId);
    if (error) throw error;
  }

  async function saveWebhook() {
    const parsed = urlSchema.safeParse(webhookUrl);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid URL");
      return;
    }
    setSavingWebhook(true);
    try {
      await persistIntegrations({ ai_vendor_webhook_url: parsed.data });
      setSavedWebhookUrl(parsed.data);
      toast.success("Webhook URL saved.");
    } catch (e: any) {
      const msg = e?.message?.includes("row-level security")
        ? "Admin permissions required."
        : e?.message ?? "Save failed.";
      toast.error(msg);
    } finally {
      setSavingWebhook(false);
    }
  }

  async function saveFhir() {
    const parsed = urlSchema.safeParse(fhirUrl);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid FHIR base URL");
      return;
    }
    if (fhirKey.length > 4096) {
      toast.error("API key too long.");
      return;
    }
    setSavingFhir(true);
    try {
      await persistIntegrations({
        fhir: { base_url: parsed.data, api_key: fhirKey || null },
      });
      setSavedFhirUrl(parsed.data);
      setSavedFhirKey(fhirKey);
      toast.success("FHIR connection saved.");
    } catch (e: any) {
      const msg = e?.message?.includes("row-level security")
        ? "Admin permissions required."
        : e?.message ?? "Save failed.";
      toast.error(msg);
    } finally {
      setSavingFhir(false);
    }
  }

  async function testFhir() {
    const parsed = urlSchema.safeParse(fhirUrl);
    if (!parsed.success) {
      setFhirTestResult({ ok: false, message: "Invalid URL" });
      return;
    }
    setTestingFhir(true);
    setFhirTestResult(null);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      // Try the standard FHIR capability statement first, fallback to root.
      const target = parsed.data.replace(/\/+$/, "") + "/metadata";
      const headers: Record<string, string> = { Accept: "application/fhir+json" };
      if (fhirKey) headers.Authorization = `Bearer ${fhirKey}`;
      const res = await fetch(target, { headers, signal: ctrl.signal, mode: "cors" });
      clearTimeout(timer);
      if (res.ok) {
        setFhirTestResult({ ok: true, message: `OK · HTTP ${res.status}` });
      } else {
        setFhirTestResult({
          ok: false,
          message: `Reached endpoint · HTTP ${res.status}`,
        });
      }
    } catch (e: any) {
      setFhirTestResult({
        ok: false,
        message:
          e?.name === "AbortError"
            ? "Timed out after 8s"
            : e?.message ?? "Network error (check CORS / URL)",
      });
    } finally {
      setTestingFhir(false);
    }
  }

  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(EVALUATE_ENDPOINT);
      setCopied(true);
      toast.success("Endpoint copied to clipboard.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed.");
    }
  }

  const webhookConfigured = useMemo(
    () => urlSchema.safeParse(savedWebhookUrl).success,
    [savedWebhookUrl],
  );
  const fhirConfigured = useMemo(
    () => urlSchema.safeParse(savedFhirUrl).success && savedFhirKey.length > 0,
    [savedFhirUrl, savedFhirKey],
  );

  const maskedKey = (v: string) =>
    v.length <= 4 ? "•".repeat(v.length) : `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`;

  return (
    <div>
      <PageHeader
        eyebrow="Console / Settings / Integrations"
        title="Integrations"
        description="AI vendor webhooks, EHR/FHIR connectivity, and edge function endpoints."
      />
      <div className="p-6 space-y-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <Link to="/settings">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to organization
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm vellum-panel p-5">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading integrations…
          </div>
        ) : !orgId ? (
          <div className="vellum-panel p-5 text-sm text-muted-foreground">
            No organization is linked to this account yet.
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {/* AI Vendor Webhook */}
            <section className="vellum-panel p-5 space-y-4">
              <header className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-accent" />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
                      Outbound
                    </div>
                    <h3 className="font-display text-lg leading-tight">AI Vendor Webhook</h3>
                  </div>
                </div>
                <StatusDot ok={webhookConfigured} />
              </header>
              <p className="text-[11px] text-muted-foreground">
                Vellum will POST evaluation events to this URL after each run completes.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.your-vendor.com/vellum"
                  maxLength={2048}
                  inputMode="url"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={saveWebhook}
                  disabled={savingWebhook || webhookUrl === savedWebhookUrl}
                  className="bg-accent text-accent-foreground hover:bg-accent-hover"
                >
                  {savingWebhook ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save webhook
                    </>
                  )}
                </Button>
              </div>
            </section>

            {/* EHR / FHIR */}
            <section className="vellum-panel p-5 space-y-4">
              <header className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-accent" />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
                      Inbound
                    </div>
                    <h3 className="font-display text-lg leading-tight">EHR / FHIR Connection</h3>
                  </div>
                </div>
                <StatusDot ok={fhirConfigured} />
              </header>
              <p className="text-[11px] text-muted-foreground">
                Used to enrich encounters with patient context (medications, problems, allergies).
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="fhir-url">FHIR base URL</Label>
                <Input
                  id="fhir-url"
                  value={fhirUrl}
                  onChange={(e) => setFhirUrl(e.target.value)}
                  placeholder="https://fhir.example.org/r4"
                  maxLength={2048}
                  inputMode="url"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fhir-key">API key</Label>
                <Input
                  id="fhir-key"
                  type="password"
                  autoComplete="new-password"
                  value={fhirKey}
                  onChange={(e) => setFhirKey(e.target.value)}
                  placeholder="••••••••"
                  maxLength={4096}
                />
                {savedFhirKey && (
                  <p className="text-[10px] font-mono text-tertiary">
                    saved: {maskedKey(savedFhirKey)}
                  </p>
                )}
              </div>
              {fhirTestResult && (
                <div
                  className={`text-[11px] font-mono px-2 py-1.5 rounded-sm border ${
                    fhirTestResult.ok
                      ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/5"
                      : "border-critical/40 text-critical bg-critical/5"
                  }`}
                >
                  {fhirTestResult.ok ? "✓" : "✗"} {fhirTestResult.message}
                </div>
              )}
              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testFhir}
                  disabled={testingFhir || !fhirUrl}
                >
                  {testingFhir ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Testing
                    </>
                  ) : (
                    <>
                      <PlugZap className="h-3.5 w-3.5 mr-1.5" /> Test connection
                    </>
                  )}
                </Button>
                <Button
                  onClick={saveFhir}
                  disabled={
                    savingFhir || (fhirUrl === savedFhirUrl && fhirKey === savedFhirKey)
                  }
                  className="bg-accent text-accent-foreground hover:bg-accent-hover"
                >
                  {savingFhir ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1.5" /> Save FHIR
                    </>
                  )}
                </Button>
              </div>
            </section>

            {/* Edge Function Endpoint */}
            <section className="vellum-panel p-5 space-y-4 lg:col-span-2">
              <header className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-tertiary">
                      Internal · evaluate-encounter
                    </div>
                    <h3 className="font-display text-lg leading-tight">
                      Edge Function Endpoint
                    </h3>
                  </div>
                </div>
                <StatusDot ok={true} label="Active" />
              </header>
              <p className="text-[11px] text-muted-foreground">
                POST notes here from your AI vendor or middleware to trigger an evaluation run.
              </p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 font-mono text-[12px] px-3 py-2 rounded-sm bg-surface border border-border break-all select-all">
                  {EVALUATE_ENDPOINT}
                </code>
                <Button variant="outline" size="sm" onClick={copyEndpoint} className="shrink-0">
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                    </>
                  )}
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}