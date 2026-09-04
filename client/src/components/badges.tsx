import type { ChangeType, ReviewStatus } from "../types/index.ts";

function badgeClass(tone: "brand" | "amber" | "quiet"): string {
  const base =
    "inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]";
  if (tone === "brand") return `${base} bg-[#EAF2EE] text-[#174C3C]`;
  if (tone === "amber") return `${base} bg-[#FBF3EA] text-[#8A5A1E]`;
  return `${base} bg-stone-100 text-stone-600`;
}

export function ChangeBadge({ changeType }: { changeType: ChangeType }) {
  const tone = changeType === "MODIFIED" ? "amber" : changeType === "UNCHANGED" ? "quiet" : "brand";
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
  const tone = status === "PROPOSED" ? "amber" : status === "CONFIRMED" ? "brand" : "quiet";
  return (
    <span className={badgeClass(tone)} aria-label={`Review status: ${REVIEW_LABELS[status]}`}>
      {REVIEW_LABELS[status]}
    </span>
  );
}

export function VersionBadge({ status }: { status: "ACTIVE" | "DRAFT" }) {
  return (
    <span
      className={badgeClass(status === "ACTIVE" ? "brand" : "amber")}
      aria-label={`Version status: ${status}`}
    >
      {status}
    </span>
  );
}

export function reviewLabel(status: ReviewStatus): string {
  return REVIEW_LABELS[status];
}
