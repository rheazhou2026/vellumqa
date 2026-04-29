import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, FileText, ClipboardCheck, BarChart3,
  ShieldCheck, Settings as SettingsIcon, Bell, LogOut,
  ChevronLeft, ChevronRight, Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/encounters", label: "Encounters", icon: FileText },
  { to: "/review", label: "QA Review", icon: ClipboardCheck, badgeKey: "pending_reviews" },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/compliance", label: "Compliance", icon: Scale },
  { to: "/governance", label: "Governance", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [email, setEmail] = useState<string>("");
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  // Real-time pending review count
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { count } = await supabase
        .from("reviewer_assignments")
        .select("*", { count: "exact", head: true })
        .eq("reviewer_id", u.user.id)
        .eq("status", "pending");
      if (mounted) setPendingCount(count ?? 0);
    }
    load();
    const ch = supabase
      .channel("assignments-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "reviewer_assignments" }, load)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/auth");
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? "w-16" : "w-60"} shrink-0 border-r border-border bg-sidebar flex flex-col transition-[width] duration-200`}
      >
        <div className={`h-14 flex items-center ${collapsed ? "justify-center" : "px-4"} border-b border-border`}>
          <Link to="/dashboard" className="font-display text-2xl tracking-tight text-foreground">
            {collapsed ? "V" : "Vellum"}
          </Link>
        </div>

        <nav className="flex-1 py-3 space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              loc.pathname === item.to || loc.pathname.startsWith(item.to + "/");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 mx-2 px-3 h-9 rounded-sm font-heading text-xs uppercase tracking-wider transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-accent -ml-[2px] pl-[14px]"
                    : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badgeKey === "pending_reviews" && pendingCount > 0 && (
                      <span className="bg-critical text-critical-foreground font-mono text-[10px] px-1.5 rounded-sm">
                        {pendingCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="h-10 border-t border-border flex items-center justify-center text-tertiary hover:text-foreground hover:bg-sidebar-accent/50 transition"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-6">
          <div className="font-mono text-[11px] uppercase tracking-widest text-tertiary">
            VELLUM // CLINICAL AI AUDIT
          </div>
          <div className="flex items-center gap-4">
            <button className="text-muted-foreground hover:text-foreground transition" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="font-mono text-xs text-muted-foreground hidden sm:block">{email}</div>
              <Button variant="ghost" size="sm" onClick={signOut} className="h-8 text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}