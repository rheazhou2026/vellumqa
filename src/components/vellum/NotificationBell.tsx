import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, Check, AlertOctagon, AlertTriangle, ClipboardCheck, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  notification_type: string;
  severity: string | null;
  title: string;
  message: string | null;
  link_path: string | null;
  read: boolean;
  created_at: string;
};

const ICON: Record<string, any> = {
  risk_critical: AlertOctagon,
  risk_high: AlertTriangle,
  review_assigned: ClipboardCheck,
  escalation: AlertTriangle,
};

const TONE: Record<string, string> = {
  S5: "text-critical",
  S4: "text-high",
  S3: "text-moderate",
  critical: "text-critical",
  urgent: "text-high",
};

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const { data: rows } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(25);
      setItems((rows as Notification[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => setItems((prev) => [payload.new as Notification, ...prev].slice(0, 25)),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => setItems((prev) => prev.map((n) => (n.id === (payload.new as Notification).id ? (payload.new as Notification) : n))),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const unread = items.filter((n) => !n.read).length;

  async function markAllRead() {
    if (!userId || unread === 0) return;
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  }

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative text-muted-foreground hover:text-foreground transition"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-critical text-critical-foreground font-mono text-[9px] flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="font-heading text-xs uppercase tracking-wider">Notifications</div>
          <button
            onClick={markAllRead}
            disabled={unread === 0}
            className="font-mono text-[10px] uppercase tracking-wider text-accent hover:text-accent-hover disabled:text-tertiary disabled:cursor-not-allowed"
          >
            <Check className="inline h-3 w-3 mr-0.5" />Mark all read
          </button>
        </div>
        <div className="max-h-[420px] overflow-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No notifications yet. Critical risk events and new review assignments stream in here.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = ICON[n.notification_type] ?? Info;
                const tone = TONE[n.severity ?? ""] ?? "text-muted-foreground";
                const inner = (
                  <div className={`flex items-start gap-2.5 p-3 transition ${n.read ? "opacity-60" : "bg-accent/[0.04]"} hover:bg-surface-muted/40`}>
                    <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${tone}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-heading text-xs text-foreground truncate">{n.title}</div>
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />}
                      </div>
                      {n.message && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>
                      )}
                      <div className="font-mono text-[10px] text-tertiary mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link_path ? (
                      <Link to={n.link_path} onClick={() => { markRead(n.id); setOpen(false); }}>
                        {inner}
                      </Link>
                    ) : (
                      <button onClick={() => markRead(n.id)} className="w-full text-left">
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
