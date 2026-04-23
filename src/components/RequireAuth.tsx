import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "authed" | "anon">("loading");
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState(session ? "authed" : "anon");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState(data.session ? "authed" : "anon");
    });
    return () => {
      mounted = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground animate-pulse-soft">
          authenticating
        </div>
      </div>
    );
  }

  if (state === "anon") {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}