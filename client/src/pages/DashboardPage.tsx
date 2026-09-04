import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPolicies } from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
import { VersionBadge } from "../components/badges.tsx";
import type { PolicyListItemDto } from "../types/index.ts";

type LoadState = "loading" | "ready" | "error";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [policies, setPolicies] = useState<PolicyListItemDto[]>([]);
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
        <h1 className="text-[30px] font-bold text-stone-900">PolicyGraph</h1>
        <p className="mt-1 text-[14px] text-stone-500">
          Trace a policy change to the forms, procedures, and software rules it affects.
        </p>

        {state === "loading" && (
          <div className="mt-6 rounded-xl border border-[#E6E7E4] bg-white p-5" aria-live="polite">
            <p className="text-sm text-stone-600">Loading policies…</p>
          </div>
        )}

        {state === "error" && (
          <div
            className="mt-6 rounded-xl border border-[#E6E7E4] bg-white p-5"
            role="alert"
          >
            <p className="text-sm font-semibold text-stone-800">Could not load policies</p>
            <p className="mt-1 text-sm text-stone-600">{error}</p>
            <p className="mt-1 text-[13px] text-stone-500">
              Confirm the API is running, then try again.
            </p>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-lg border border-[#174C3C] bg-white px-3 py-1.5 text-sm font-semibold text-[#174C3C] hover:bg-[#F0F4F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
            >
              Retry
            </button>
          </div>
        )}

        {state === "ready" && policies.length === 0 && (
          <div className="mt-6 rounded-xl border border-[#E6E7E4] bg-white p-5">
            <p className="text-sm font-semibold text-stone-800">No policies yet</p>
            <p className="mt-1 text-sm text-stone-600">
              Seed the database with the Travel Reimbursement Policy to begin.
            </p>
          </div>
        )}

        {state === "ready" && policies.length > 0 && (
          <div id="policies" className="mt-6 flex flex-col gap-4">
            {policies.map((policy) => (
              <article
                key={policy.id}
                className="rounded-xl border border-[#E6E7E4] bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[18px] font-semibold text-stone-900">{policy.title}</h2>
                    {policy.description && (
                      <p className="mt-1 max-w-xl text-[13.5px] text-stone-500">
                        {policy.description}
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/policies/${policy.id}`}
                    className="rounded-lg bg-[#174C3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F3529] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
                  >
                    Open policy
                  </Link>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-[#E6E7E4] bg-[#F7F7F5] px-3 py-2.5">
                    <dt className="text-[11px] font-medium text-stone-500">Active version</dt>
                    <dd className="mt-1 text-sm font-semibold text-stone-800">
                      {policy.activeVersion ? (
                        <span className="flex items-center gap-2">
                          v{policy.activeVersion.versionNumber} <VersionBadge status="ACTIVE" />
                        </span>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-[#E6E7E4] bg-[#F7F7F5] px-3 py-2.5">
                    <dt className="text-[11px] font-medium text-stone-500">Draft version</dt>
                    <dd className="mt-1 text-sm font-semibold text-stone-800">
                      {policy.draftVersion ? (
                        <span className="flex items-center gap-2">
                          v{policy.draftVersion.versionNumber} <VersionBadge status="DRAFT" />
                        </span>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-[#E6E7E4] bg-[#F7F7F5] px-3 py-2.5">
                    <dt className="text-[11px] font-medium text-stone-500">Approved dependencies</dt>
                    <dd className="mt-1 text-sm font-semibold text-stone-800">
                      {policy.approvedDependencyCount}
                    </dd>
                  </div>
                  <div
                    id={policies[0]?.id === policy.id ? "latest" : undefined}
                    className="rounded-lg border border-[#E6E7E4] bg-[#F7F7F5] px-3 py-2.5"
                  >
                    <dt className="text-[11px] font-medium text-stone-500">Latest impact run</dt>
                    <dd className="mt-1 text-sm font-semibold text-stone-800">
                      {policy.latestImpactRun ? (
                        <Link
                          to={`/impact-runs/${policy.latestImpactRun.id}`}
                          className="text-[#174C3C] underline decoration-[#174C3C]/30 underline-offset-2 hover:decoration-[#174C3C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
                        >
                          {policy.latestImpactRun.resultCount} affected ·{" "}
                          {formatDate(policy.latestImpactRun.createdAt)}
                        </Link>
                      ) : (
                        <span className="font-normal text-stone-500">None yet</span>
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
