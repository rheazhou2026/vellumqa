import { useParams, NavLink } from "react-router-dom";
import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";

const TABS = [
  { to: "/analytics", label: "Overview" },
  { to: "/analytics/vendors", label: "Vendors" },
  { to: "/analytics/specialties", label: "Specialties" },
  { to: "/analytics/drift", label: "Drift" },
];

export default function Analytics() {
  const { tab = "overview" } = useParams();
  return (
    <div>
      <PageHeader eyebrow="Console / Analytics" title="AI performance" description="Trust score, hallucination, omission, and critical-failure trends across vendors, specialties, and time." />
      <div className="px-6 border-b border-border flex gap-1">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === "/analytics"}
            className={({ isActive }) =>
              `px-4 py-2.5 font-heading text-xs uppercase tracking-wider border-b-2 -mb-px transition ${
                isActive ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <div className="p-6">
        <StubPanel title={`${tab[0].toUpperCase() + tab.slice(1)} analytics`} description="Recharts time-series, heatmaps, vendor comparison tables, and drift annotations populate once evaluation data accumulates." />
      </div>
    </div>
  );
}