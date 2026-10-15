import type { ReactNode } from "react";

interface StateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" className="rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card">
      <p className="type-body-md text-text-secondary">{message}</p>
    </div>
  );
}

export function EmptyState({ title, description, action }: StateProps) {
  return (
    <section className="rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card">
      <h2 className="type-card-title text-ink">{title}</h2>
      {description && <p className="type-body-md mt-4 max-w-[72ch] text-text-secondary">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}

export function ErrorState({ title, description, action }: StateProps) {
  return (
    <section role="alert" className="rounded-card border border-border-strong border-l-2 border-l-ink bg-surface-white p-7 text-ink">
      <p className="type-label-sm flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="m6 6 12 12" />
        </svg>
        Blocked
      </p>
      <h2 className="type-card-title mt-4">{title}</h2>
      {description && <p className="type-body-md mt-4 max-w-[72ch] text-text-secondary">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}
