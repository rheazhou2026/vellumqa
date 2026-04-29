import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  UserPlus,
  Trash2,
  ArrowLeft,
  Users,
  Mail,
} from "lucide-react";

import PageHeader from "@/components/vellum/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const ROLES = [
  { value: "clinician", label: "Clinician" },
  { value: "qa_reviewer", label: "QA Reviewer" },
  { value: "compliance", label: "Compliance" },
  { value: "governance", label: "Governance" },
  { value: "admin", label: "Admin" },
] as const;

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label]),
);

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(255, "Email too long"),
  role: z.enum(["clinician", "qa_reviewer", "compliance", "governance", "admin"]),
  specialty: z.string().trim().max(80, "Specialty must be ≤ 80 chars").optional().nullable(),
});

type Member = {
  id: string;
  display_name: string | null;
  email: string | null;
  invited_email: string | null;
  vellum_role: string;
  specialty: string | null;
  status: string;
  user_id: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === "active"
      ? { label: "Active", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" }
      : status === "invited"
        ? { label: "Invited", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30" }
        : { label: "Removed", cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span
      className={`inline-block text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

export default function Team() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("clinician");
  const [specialty, setSpecialty] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) {
        toast.error("Sign in to manage your team.");
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

      setOrgId(resolvedId);
      if (!resolvedId) {
        setMembers([]);
        return;
      }

      const { data, error } = await supabase
        .from("vellum_users")
        .select(
          "id, display_name, email, invited_email, vellum_role, specialty, status, user_id",
        )
        .eq("organization_id", resolvedId)
        .neq("status", "removed")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMembers((data ?? []) as Member[]);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load team.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEmail("");
    setRole("clinician");
    setSpecialty("");
  }

  async function invite() {
    const parsed = inviteSchema.safeParse({
      email,
      role,
      specialty: specialty.trim() || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    if (!orgId) {
      toast.error("No organization linked to this account.");
      return;
    }
    // Prevent duplicate invites for the same email in the same org.
    const dupe = members.find(
      (m) =>
        (m.email?.toLowerCase() ?? "") === parsed.data.email.toLowerCase() ||
        (m.invited_email?.toLowerCase() ?? "") === parsed.data.email.toLowerCase(),
    );
    if (dupe) {
      toast.error("That email is already on this team.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const inviterId = userRes?.user?.id ?? null;

      const { error } = await supabase.from("vellum_users").insert({
        organization_id: orgId,
        invited_email: parsed.data.email,
        email: parsed.data.email,
        vellum_role: parsed.data.role,
        specialty: parsed.data.specialty,
        status: "invited",
        invited_by: inviterId,
        // user_id intentionally null until the invitee signs up
      });
      if (error) throw error;
      toast.success(`Invite sent to ${parsed.data.email}`);
      setOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.includes("row-level security")
        ? "Admin permissions required to invite members."
        : e?.message ?? "Invite failed.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this team member? They'll lose access to the workspace.")) return;
    setRemovingId(id);
    try {
      const { error } = await supabase
        .from("vellum_users")
        .update({ status: "removed", removed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success("Member removed.");
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.includes("row-level security")
        ? "Admin permissions required to remove members."
        : e?.message ?? "Remove failed.";
      toast.error(msg);
    } finally {
      setRemovingId(null);
    }
  }

  const empty = useMemo(() => !loading && members.length === 0, [loading, members]);

  return (
    <div>
      <PageHeader
        eyebrow="Console / Settings / Team"
        title="Team"
        description="Invite members and assign Clinician, QA Reviewer, Compliance, Governance, or Admin roles."
      />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <Link to="/settings">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to organization
            </Link>
          </Button>
          <Button
            onClick={() => setOpen(true)}
            disabled={!orgId || loading}
            className="bg-accent text-accent-foreground hover:bg-accent-hover"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite member
          </Button>
        </div>

        <section className="vellum-panel">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
            </div>
          ) : empty ? (
            <div className="p-10 text-center space-y-3">
              <div className="mx-auto h-10 w-10 rounded-sm border border-border flex items-center justify-center text-muted-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="font-display text-base">
                No team members yet. Invite your first member.
              </div>
              <Button
                onClick={() => setOpen(true)}
                disabled={!orgId}
                className="bg-accent text-accent-foreground hover:bg-accent-hover"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite member
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const displayEmail = m.email ?? m.invited_email ?? "—";
                  const displayName =
                    m.display_name ?? (m.status === "invited" ? "(pending)" : "—");
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{displayName}</TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">
                        {displayEmail}
                      </TableCell>
                      <TableCell>
                        {ROLE_LABEL[m.vellum_role] ?? m.vellum_role}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.specialty ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={m.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(m.id)}
                          disabled={removingId === m.id}
                          className="text-critical hover:text-critical hover:bg-critical/10"
                        >
                          {removingId === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" /> Invite team member
            </DialogTitle>
            <DialogDescription>
              They'll be added as pending until they sign in with this email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@hospital.org"
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-specialty">Specialty</Label>
              <Input
                id="invite-specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Emergency Medicine"
                maxLength={80}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={invite}
              disabled={submitting}
              className="bg-accent text-accent-foreground hover:bg-accent-hover"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Send invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}