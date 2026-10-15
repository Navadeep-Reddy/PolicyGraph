import type { ChangeType, ReviewStatus } from "../types/index.ts";

type BadgeTone = "active" | "review" | "proposed" | "positive" | "neutral";

function badgeClass(tone: BadgeTone): string {
  const base =
    "type-label-sm inline-block rounded-chip px-3 py-1";
  if (tone === "active") return `${base} bg-ink text-on-dark`;
  if (tone === "review")
    return `${base} border border-border-strong bg-surface-2 text-accent`;
  if (tone === "proposed")
    return `${base} border border-dashed border-border-strong bg-surface-2 text-accent`;
  if (tone === "positive")
    return `${base} border border-positive-border bg-positive-bg text-positive-text`;
  return `${base} border border-border-default bg-surface-1 text-text-muted`;
}

export function ChangeBadge({ changeType }: { changeType: ChangeType }) {
  const tone: BadgeTone =
    changeType === "MODIFIED" || changeType === "ADDED" ? "review" : "neutral";
  return (
    <span className={badgeClass(tone)} aria-label={`Change state: ${changeType}`}>
      {changeType}
    </span>
  );
}

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  PROPOSED: "Proposed",
  CONFIRMED: "Confirmed",
  DISMISSED: "Dismissed",
  RESOLVED: "Resolved",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const tone: BadgeTone =
    status === "PROPOSED"
      ? "proposed"
      : status === "CONFIRMED"
        ? "active"
        : status === "RESOLVED"
          ? "positive"
          : "neutral";
  return (
    <span className={badgeClass(tone)} aria-label={`Review status: ${REVIEW_LABELS[status]}`}>
      {REVIEW_LABELS[status]}
    </span>
  );
}

export function VersionBadge({ status }: { status: "ACTIVE" | "DRAFT" }) {
  return (
    <span
      className={badgeClass(status === "ACTIVE" ? "active" : "neutral")}
      aria-label={`Version status: ${status}`}
    >
      {status}
    </span>
  );
}

export function reviewLabel(status: ReviewStatus): string {
  return REVIEW_LABELS[status];
}
