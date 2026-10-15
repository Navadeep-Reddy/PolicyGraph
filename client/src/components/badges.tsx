import type { ChangeType, DependencyStatus, ReviewStatus, VersionStatus } from "../types/index.ts";

type BadgeTone = "active" | "review" | "proposed" | "positive" | "neutral" | "history";

function badgeClass(tone: BadgeTone): string {
  const base =
    "type-label-sm inline-flex items-center gap-2 rounded-chip px-3 py-1";
  if (tone === "active") return `${base} bg-ink text-on-dark`;
  if (tone === "review")
    return `${base} border border-border-strong bg-surface-2 text-accent`;
  if (tone === "proposed")
    return `${base} border border-dashed border-border-strong bg-surface-2 text-accent`;
  if (tone === "positive")
    return `${base} border border-positive-border bg-positive-bg text-positive-text`;
  if (tone === "history") return `${base} border border-border-default bg-transparent text-text-muted`;
  return `${base} border border-border-default bg-surface-1 text-text-muted`;
}

export function ChangeBadge({ changeType }: { changeType: ChangeType }) {
  const tone: BadgeTone =
    changeType === "MODIFIED" || changeType === "ADDED" ? "review" : "neutral";
  return (
    <span className={badgeClass(tone)} aria-label={`Change state: ${changeType}`}>
      {changeType !== "UNCHANGED" && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          {changeType === "ADDED" ? <path d="M8 2v12M2 8h12" /> : changeType === "REMOVED" ? <path d="M2 8h12" /> : <path d="m3 11 1-4 6-5 3 3-6 6-4 1Z" />}
        </svg>
      )}
      {changeType}
    </span>
  );
}

export function StatusBadge({ status }: { status: ReviewStatus | DependencyStatus | VersionStatus }) {
  const tone: BadgeTone =
    status === "PROPOSED"
      ? "proposed"
      : status === "CONFIRMED" || status === "APPROVED"
        ? "active"
        : status === "RESOLVED" || status === "ACTIVE"
          ? "positive"
          : status === "ARCHIVED" ? "history" : "neutral";
  return (
    <span className={badgeClass(tone)} aria-label={`Status: ${status}`}>
      {status === "ARCHIVED" && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>}
      {status}
    </span>
  );
}

export function VersionBadge({ status }: { status: VersionStatus }) {
  return <StatusBadge status={status} />;
}
