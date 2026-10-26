import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { listPolicies } from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
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

  const activeCount = policies.filter((policy) => policy.activeVersionNumber !== null).length;
  const draftCount = policies.filter((policy) => policy.draftVersionId !== null).length;
  const dependencyCount = policies.reduce((count, policy) => count + policy.approvedDependencyCount, 0);

  return (
    <AppShell breadcrumb="Policy operations / Policies">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="type-page-title text-ink">Policies</h1>
          <p className="type-body-lg mt-2 max-w-[68ch] text-text-secondary">
            Current versions and operational review status.
          </p>
        </div>
        <Link to="/policies/new" className="type-label-md inline-flex h-11 items-center justify-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent">
          New policy
        </Link>
      </div>

      {state === "loading" && <div className="mt-7"><LoadingState message="Loading policies…" /></div>}

      {state === "error" && (
        <div className="mt-7"><ErrorState title="Could not load policies" description={`${error} Confirm the API is running, then retry.`} action={<button type="button" onClick={load} className="type-label-md mt-3 inline-flex h-11 items-center rounded-action border border-border-default bg-surface-white px-6 text-ink hover:bg-surface-2">Retry</button>} /></div>
      )}

      {state === "ready" && policies.length === 0 && (
        <div className="mt-7"><EmptyState title="No policies yet" description="Create a policy to start tracking clause changes and the operational items they may affect." action={<Link to="/policies/new" className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent">Create your first policy</Link>} /></div>
      )}

      {state === "ready" && policies.length > 0 && (
        <>
          <dl className="mt-7 grid grid-cols-2 border-y border-border-strong sm:grid-cols-4">
            <div className="border-r border-border-faint px-4 py-4 sm:px-6"><dt className="type-label-sm text-text-muted">Policies</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{policies.length}</dd></div>
            <div className="border-r border-border-faint px-4 py-4 sm:px-6"><dt className="type-label-sm text-text-muted">Active versions</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{activeCount}</dd></div>
            <div className="border-r border-border-faint px-4 py-4 sm:px-6"><dt className="type-label-sm text-text-muted">Drafts in progress</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{draftCount}</dd></div>
            <div className="px-4 py-4 sm:px-6"><dt className="type-label-sm text-text-muted">Approved dependencies</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{dependencyCount}</dd></div>
          </dl>

          <section id="policies" className="mt-8" aria-labelledby="policy-register-title">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="policy-register-title" className="type-section-title text-ink">Policy register</h2>
              <span className="type-micro-mono text-text-muted">{policies.length} RECORDS</span>
            </div>
            <div className="overflow-hidden rounded-panel border border-border-strong bg-glass-90 shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] border-collapse text-left">
                  <caption className="sr-only">Policies, current and draft versions, approved dependencies, and latest impact reports</caption>
                  <thead><tr className="border-b border-border-strong">
                    <th className="type-label-md px-4 py-3 text-text-muted">Policy</th>
                    <th className="type-label-md px-4 py-3 text-text-muted">Active version</th>
                    <th className="type-label-md px-4 py-3 text-text-muted">Draft</th>
                    <th className="type-label-md px-4 py-3 text-text-muted">Dependencies</th>
                    <th className="type-label-md px-4 py-3 text-text-muted">Latest impact</th>
                  </tr></thead>
                  <tbody>{policies.map((policy) => (
                    <tr key={policy.id} className="border-b border-border-faint last:border-0 hover:bg-row-hover">
                      <td className="px-4 py-4"><Link to={`/policies/${policy.id}`} className="font-semibold text-ink hover:text-accent">{policy.title}</Link>{policy.description && <p className="type-body-sm mt-1 max-w-[42ch] text-text-muted">{policy.description}</p>}</td>
                      <td className="type-body-sm px-4 py-4 text-text-secondary">{policy.activeVersionNumber === null ? <span className="text-text-muted">Not published</span> : <span className="inline-flex items-center gap-2"><span className="route-node h-2.5 w-2.5" style={{ "--route-color": "var(--route-green)" } as CSSProperties} />v{policy.activeVersionNumber} · Active</span>}</td>
                      <td className="type-body-sm px-4 py-4 text-text-secondary">{policy.draftVersionId ? <Link to={`/policies/${policy.id}`} className="inline-flex items-center gap-2 text-ink hover:text-accent"><span className="route-node h-2.5 w-2.5" style={{ "--route-color": "var(--route-amber)" } as CSSProperties} />Draft in progress</Link> : <span className="text-text-muted">—</span>}</td>
                      <td className="type-micro-mono px-4 py-4 text-ink">{policy.approvedDependencyCount}</td>
                      <td className="type-body-sm px-4 py-4">{policy.latestImpactRunId ? <Link id={policies[0]?.id === policy.id ? "latest" : undefined} to={`/impact-runs/${policy.latestImpactRunId}`} className="text-accent underline decoration-accent/30 hover:decoration-accent">View impact report →</Link> : <span id={policies[0]?.id === policy.id ? "latest" : undefined} className="text-text-muted">None yet</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
