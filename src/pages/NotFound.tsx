import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Stethoscope, ArrowRight, Home, KeyRound, LayoutDashboard } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-ink text-primary-foreground">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">Vellum</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Clinical QA</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 shadow-paper">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Error 404</div>
          <h1 className="mt-2 font-display text-3xl font-semibold">This page doesn't exist.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The route <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">{location.pathname}</span> isn't part of Vellum. You probably want one of these:
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <Link to="/">
              <Button variant="outline" className="w-full justify-start gap-2"><Home className="h-4 w-4" /> Landing</Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" className="w-full justify-start gap-2"><KeyRound className="h-4 w-4" /> Sign in</Button>
            </Link>
            <Link to="/app">
              <Button className="w-full justify-start gap-2 bg-gradient-ink text-primary-foreground hover:opacity-90">
                <LayoutDashboard className="h-4 w-4" /> App
              </Button>
            </Link>
          </div>
          <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            Stuck on a blank screen? Visit <Link to="/app/diagnostics" className="text-accent underline">/app/diagnostics</Link> after signing in to inspect routing, auth, and guideline seed status. <ArrowRight className="ml-1 inline h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
