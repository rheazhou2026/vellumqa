import PageHeader from "@/components/vellum/PageHeader";
import StubPanel from "@/components/vellum/StubPanel";

export default function Settings() {
  return (
    <div>
      <PageHeader eyebrow="Console / Settings" title="Organization" description="Org details, jurisdiction, team roles, and integrations." />
      <div className="p-6 grid lg:grid-cols-3 gap-4">
        <StubPanel title="Organization" description="Name, logo, jurisdiction, default guideline stack, escalation thresholds." />
        <StubPanel title="Team" description="Invite members, assign Clinician / QA Reviewer / Compliance / Governance / Admin roles." />
        <StubPanel title="Integrations" description="AI vendor webhook URL, EHR/FHIR connection, integration health." />
      </div>
    </div>
  );
}