import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-tertiary mb-4">ERR // 404</div>
        <h1 className="font-display text-6xl mb-4">Not found</h1>
        <p className="text-muted-foreground mb-8">
          The route you requested does not exist in the Vellum console.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/dashboard" className="px-4 h-10 inline-flex items-center bg-accent hover:bg-accent-hover text-accent-foreground font-heading uppercase tracking-wider text-xs rounded-sm">
            Dashboard
          </Link>
          <Link to="/auth" className="px-4 h-10 inline-flex items-center border border-border hover:border-border-strong font-heading uppercase tracking-wider text-xs rounded-sm">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}