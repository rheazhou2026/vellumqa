import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, GitBranch, FileSearch } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate("/dashboard", { replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        toast.success("Account created. Signing you in…");
        const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
        if (siErr) {
          // Fallback: email confirmation may be required
          toast.message("Check your email to verify before signing in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) {
        toast.error(result.error instanceof Error ? result.error.message : "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) {
        // browser is navigating to Google — leave loading state on
        return;
      }
      // Tokens were returned and session is set. Route immediately;
      // onAuthStateChange will also fire, but we don't want to wait for it.
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-r border-border vellum-grid-bg">
        <div>
          <h1 className="font-display text-5xl text-foreground tracking-tight">Vellum</h1>
          <p className="mt-3 font-heading text-sm uppercase tracking-[0.18em] text-muted-foreground">
            Independent Clinical AI Trust Infrastructure
          </p>
        </div>

        <div className="space-y-6">
          {[
            { icon: FileSearch, t: "Source-Grounded Validation", d: "Every AI claim verified against transcript and EHR evidence." },
            { icon: ShieldCheck, t: "Specialty-Aware Risk Scoring", d: "Severity calibrated by specialty acuity and patient vulnerability." },
            { icon: GitBranch, t: "Regulator-Ready Audit Trail", d: "Immutable evidence trail for every evaluation, review, and override." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-4 border-l border-border-strong pl-4">
              <Icon className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div>
                <div className="font-heading text-sm font-semibold text-foreground">{t}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{d}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 font-mono text-[10px] uppercase tracking-widest text-tertiary">
          <span className="border border-border-strong px-2 py-1">HIPAA</span>
          <span className="border border-border-strong px-2 py-1">SOC 2</span>
          <span className="border border-border-strong px-2 py-1">21 CFR Part 11</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <h1 className="font-display text-4xl">Vellum</h1>
          </div>
          <div className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            {mode === "signin" ? "Reviewer Sign In" : "Create Reviewer Account"}
          </div>
          <h2 className="font-display text-3xl mb-8">
            {mode === "signin" ? "Continue to console" : "Create your account"}
          </h2>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name" className="font-heading text-xs uppercase tracking-wider text-muted-foreground">Full name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className="mt-1.5 bg-surface border-border" />
              </div>
            )}
            <div>
              <Label htmlFor="email" className="font-heading text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="mt-1.5 bg-surface border-border font-mono text-sm" />
            </div>
            <div>
              <Label htmlFor="pw" className="font-heading text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} className="mt-1.5 bg-surface border-border" />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent-hover text-accent-foreground font-heading uppercase tracking-wider text-xs h-10 rounded-sm">
              {loading ? "…" : mode === "signin" ? "Continue" : "Create account"}
            </Button>

            {mode === "signin" && (
              <>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-background px-3 font-mono text-[10px] uppercase tracking-widest text-tertiary">or</span></div>
                </div>

                <Button type="button" variant="outline" onClick={google} disabled={loading} className="w-full border-border bg-surface hover:bg-surface-muted h-10 rounded-sm font-heading uppercase tracking-wider text-xs">
                  Continue with Google
                </Button>
                <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
                  No Google account on file? We'll create one automatically.
                </p>
              </>
            )}

            {mode === "signup" && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Reviewer accounts are provisioned instantly. You'll be routed to the console after sign-up.
              </p>
            )}

            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition pt-2">
              {mode === "signin" ? "Create an account" : "Already have an account? Sign in"}
            </button>

            <div className="pt-4 text-center">
              <Link to="/faq" className="text-[11px] font-heading uppercase tracking-[0.18em] text-tertiary hover:text-accent transition">
                Watch demo & FAQ →
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}