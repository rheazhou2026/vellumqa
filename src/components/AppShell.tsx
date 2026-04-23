import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Stethoscope,
  LayoutDashboard,
  FileSearch,
  Layers,
  BookMarked,
  Activity,
  Cpu,
  LogOut,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/review", label: "Review Note", icon: FileSearch },
  { to: "/app/bulk", label: "Bulk Processing", icon: Layers },
  { to: "/app/guidelines", label: "Guidelines Library", icon: BookMarked },
  { to: "/app/analytics", label: "AI Performance", icon: Activity },
  { to: "/app/sources", label: "AI Sources", icon: Cpu },
  { to: "/app/diagnostics", label: "Diagnostics", icon: Wrench },
];

export function AppShell() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface-muted/60 px-4 py-6 lg:flex">
          <Link to="/app" className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-ink text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-semibold">Vellum</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Clinical QA
              </div>
            </div>
          </Link>

          <nav className="flex-1 space-y-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-surface text-foreground shadow-paper"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 rounded-md border border-border bg-surface p-3">
            <div className="truncate text-xs text-muted-foreground">{email}</div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-8 w-full justify-start gap-2 px-2 text-xs"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </aside>

        <main className="flex-1 px-6 py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}