import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPolicies } from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
import { VersionBadge } from "../components/badges.tsx";
import { EmptyState, ErrorState, LoadingState } from "../components/DataStates.tsx";
import type { PolicySummary } from "../types/index.ts";

type LoadState = "loading" | "ready" | "error";

export default function DashboardPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [error, setError] = useState("");

  const load = () => {
    setState("loading");
    setError("");
    listPolicies()
      .then((rows) => {
        setPolicies(rows);
        setState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not reach the API.");
        setState("error");
      });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell breadcrumb="Overview">
      <div className="mx-auto max-w-4xl">
        <h1 className="type-page-title text-ink">CareSync</h1>
        <p className="type-body-lg mt-1 text-text-secondary">
          Trace hospital policy changes to the operational items that may need review.
        </p>

        {state === "loading" && (
          <div className="mt-6"><LoadingState message="Loading policies…" /></div>
        )}

        {state === "error" && (
          <div className="mt-6"><ErrorState title="Could not load policies" description={`${error} Confirm the API is running, then retry.`} action={<button
              type="button"
              onClick={load}
              className="type-label-md mt-3 inline-flex h-11 items-center rounded-action border border-border-default bg-glass-80 px-6 text-ink backdrop-blur-card hover:bg-surface-2"
            >
              Retry
            </button>} /></div>
        )}

        {state === "ready" && policies.length === 0 && (
          <div className="mt-6"><EmptyState title="No policies yet" description="No policies have been added yet. New policies will appear here once created." /></div>
        )}

        {state === "ready" && policies.length > 0 && (
          <div id="policies" className="mt-6 flex flex-col gap-4">
            {policies.map((policy) => (
              <article
                key={policy.id}
                className="rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="type-item-title text-ink">{policy.title}</h2>
                    {policy.description && (
                      <p className="type-body-md mt-1 max-w-xl text-text-muted">
                        {policy.description}
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/policies/${policy.id}`}
                    className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent"
                  >
                    Open policy
                  </Link>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-inner border border-border-faint bg-surface-1 px-3 py-2.5">
                    <dt className="type-label-sm text-text-muted">Active version</dt>
                    <dd className="type-body-md mt-1 text-ink">
                      {policy.activeVersionNumber !== null ? (
                        <span className="flex items-center gap-2">
                          v{policy.activeVersionNumber} <VersionBadge status="ACTIVE" />
                        </span>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="rounded-inner border border-border-faint bg-surface-1 px-3 py-2.5">
                    <dt className="type-label-sm text-text-muted">Draft version</dt>
                    <dd className="type-body-md mt-1 text-ink">
                      {policy.draftVersionId ? (
                        <span className="flex items-center gap-2">
                          <VersionBadge status="DRAFT" />
                        </span>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="rounded-inner border border-border-faint bg-surface-1 px-3 py-2.5">
                    <dt className="type-label-sm text-text-muted">Approved dependencies</dt>
                    <dd className="type-body-md mt-1 text-ink">
                      {policy.approvedDependencyCount}
                    </dd>
                  </div>
                  <div
                    id={policies[0]?.id === policy.id ? "latest" : undefined}
                    className="rounded-inner border border-border-faint bg-surface-1 px-3 py-2.5"
                  >
                    <dt className="type-label-sm text-text-muted">Latest impact run</dt>
                    <dd className="type-body-md mt-1 text-ink">
                      {policy.latestImpactRunId ? (
                        <Link
                          to={`/impact-runs/${policy.latestImpactRunId}`}
                          className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
                        >
                          View impact report
                        </Link>
                      ) : (
                        <span className="text-text-muted">None yet</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
