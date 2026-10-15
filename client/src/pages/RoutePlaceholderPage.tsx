import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";

interface RoutePlaceholderPageProps {
  title: string;
  description: string;
}

// Route destinations are established before their screen implementation tasks.
export default function RoutePlaceholderPage({ title, description }: RoutePlaceholderPageProps) {
  return (
    <AppShell breadcrumb={`Workspace / ${title}`}>
      <h1 className="type-page-title text-ink">{title}</h1>
      <p className="type-body-md mt-4 max-w-[72ch] text-text-secondary">{description}</p>
      <section className="mt-6 rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card" aria-labelledby="screen-status">
        <h2 id="screen-status" className="type-card-title">Screen under construction</h2>
        <p className="type-body-md mt-4 text-text-secondary">This destination is ready for the next frontend implementation stage.</p>
        <Link to="/" className="type-label-md mt-6 inline-flex h-11 items-center rounded-action border border-border-default bg-glass-80 px-6 text-ink hover:bg-surface-2">Back to dashboard</Link>
      </section>
    </AppShell>
  );
}
