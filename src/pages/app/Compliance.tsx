import { useParams, NavLink } from "react-router-dom";
import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";
import ConsentTab from "@/components/vellum/ConsentTab";
import AuditTab from "@/components/vellum/AuditTab";

const TABS = [
  { to: "/compliance", label: "Consent" },
  { to: "/compliance/audit", label: "Audit Trail" },
  { to: "/compliance/legal", label: "Legal Exposure" },
];

export default function Compliance() {
  const { tab = "consent" } = useParams();
  return (
    <div>
      <PageHeader eyebrow="Console / Compliance" title="Regulatory console" description="Consent tracking, immutable audit trail, and medico-legal exposure scoring." />
      <div className="px-6 border-b border-border flex gap-1">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === "/compliance"} className={({ isActive }) => `px-4 py-2.5 font-heading text-xs uppercase tracking-wider border-b-2 -mb-px transition ${isActive ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </NavLink>
        ))}
      </div>
      <div className="p-6">
        {tab === "consent" ? (
          <ConsentTab />
        ) : tab === "audit" ? (
          <AuditTab />
        ) : (
          <StubPanel
            title={`${tab} module`}
            description="Consent disclosure tracking, audit_events ledger with NDJSON/PDF export, and 8-dimension medico-legal exposure grid populate when ingestion is connected."
          />
        )}
      </div>
    </div>
  );
}