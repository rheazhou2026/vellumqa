export default function StubPanel({
  title,
  description,
  status = "PLANNED",
}: {
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <div className="vellum-panel p-8">
      <div className="font-mono text-[10px] uppercase tracking-widest text-accent mb-3">{status}</div>
      <div className="font-heading text-base font-semibold mb-2">{title}</div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}