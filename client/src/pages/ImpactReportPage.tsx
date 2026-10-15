import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getImpactRun,
  humanArtifactType,
  updateImpactResult,
} from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
import DependencyGraph from "../components/DependencyGraph.tsx";
import PathViewer from "../components/PathViewer.tsx";
import { ChangeBadge, StatusBadge, reviewLabel } from "../components/badges.tsx";
import type { ImpactReportDto, ImpactResultDto, ReviewStatus } from "../types/index.ts";

function hopsLabel(distance: number): string {
  return distance === 1 ? "1 hop away" : `${distance} hops away`;
}

export default function ImpactReportPage() {
  const { impactRunId = "" } = useParams();
  const [report, setReport] = useState<ImpactReportDto | null>(null);
  const [results, setResults] = useState<ImpactResultDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    getImpactRun(impactRunId)
      .then((fetched) => {
        if (cancelled) return;
        setReport(fetched);
        setResults(fetched.results);
        setSelectedId(fetched.results[0]?.id ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Could not reach the API.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [impactRunId]);

  const selected = useMemo(
    () => results.find((result) => result.id === selectedId) ?? null,
    [results, selectedId],
  );

  const selectedNodeIds = useMemo(
    () => selected?.path.nodes.map((node) => node.id) ?? [],
    [selected],
  );
  const selectedEdgeIds = useMemo(
    () => selected?.path.edges.map((edge) => edge.id) ?? [],
    [selected],
  );

  const handleReview = async (status: ReviewStatus) => {
    if (!selected) return;
    setSaving(true);
    setFeedback("");
    setReviewError("");
    try {
      const updated = await updateImpactResult(
        selected.id,
        status,
        note.trim().length > 0 ? note.trim() : undefined,
      );
      setResults((previous) =>
        previous.map((result) => (result.id === updated.id ? updated : result)),
      );
      setFeedback(`Marked as ${reviewLabel(updated.reviewStatus).toLowerCase()}.`);
      setNote("");
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : "Updating review status failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumb="Impact Runs">
        <div
          className="mx-auto max-w-6xl rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card"
          aria-live="polite"
        >
          <p className="type-body-md text-text-secondary">Loading impact report…</p>
        </div>
      </AppShell>
    );
  }

  if (!report) {
    return (
      <AppShell breadcrumb="Impact Runs">
        <div
          className="mx-auto max-w-6xl rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card"
          role="alert"
        >
          <p className="type-item-title text-ink">Impact run not found</p>
          <p className="type-body-md mt-1 text-text-secondary">
            {loadError || "This report does not exist."}
          </p>
          <Link
            to="/"
            className="type-body-md mt-3 inline-block px-3 py-1.5 text-accent hover:bg-surface-2"
          >
            ← Back to overview
          </Link>
        </div>
      </AppShell>
    );
  }

  const modifiedChanges = report.changeSummary.filter(
    (change) => change.changeType === "MODIFIED" || change.changeType === "ADDED",
  );

  return (
    <AppShell breadcrumb={`Impact Runs / ${report.id.slice(0, 8)}`}>
      <div className="mx-auto max-w-6xl">
        <Link
          to={`/policies/${report.policyId}`}
          className="type-body-md text-text-muted hover:text-accent"
        >
          ← Back to policy
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="type-page-title text-ink">Impact analysis</h1>
            <div className="type-body-sm mt-1 flex flex-wrap items-center gap-2 text-text-muted">
              {modifiedChanges.slice(0, 3).map((change) => (
                <span key={change.stableKey} className="inline-flex items-center gap-1.5">
                  <span className="type-micro-mono uppercase text-accent">
                    {change.stableKey}
                  </span>
                  <ChangeBadge changeType={change.changeType} />
                </span>
              ))}
              <span aria-live="polite">
                {results.length === 1
                  ? "1 affected artifact"
                  : `${results.length} affected artifacts`}
              </span>
            </div>
          </div>
        </div>

        {results.length === 0 ? (
          <div
            className="mt-6 rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card"
            aria-live="polite"
          >
            <p className="type-item-title text-ink">No affected artifacts</p>
            <p className="type-body-md mt-1 text-text-secondary">
              The changed clause has no approved downstream dependencies, so there is nothing to
              review.
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4 lg:flex-row">
            {/* Result list: ~36% on desktop, stacked above the graph on narrow screens. */}
            <section
              aria-label="Impacted artifacts"
              className="rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card lg:w-[36%] lg:shrink-0"
            >
              <h2 className="type-card-title px-1 text-ink">Impacted artifacts</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {results.map((result) => {
                  const isSelected = result.id === selectedId;
                  return (
                    <li key={result.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(result.id)}
                        aria-pressed={isSelected}
                        className={`w-full rounded-inner border-l-[2px] px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "border-l-accent bg-accent-wash"
                            : "border-l-transparent hover:bg-surface-2"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-ink">
                          {result.artifact.name}
                        </span>
                        <span className="type-body-sm mt-0.5 block text-text-muted">
                          {humanArtifactType(result.artifact.type)} · {hopsLabel(result.distance)}
                        </span>
                        <span className="mt-1.5 block">
                          <StatusBadge status={result.reviewStatus} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selected && (
                <div className="mt-4 border-t border-border-faint pt-4">
                  <h3 className="text-sm font-semibold text-ink">
                    Review: {selected.artifact.name}
                  </h3>
                  <p className="type-body-sm mt-1 text-text-secondary">{selected.reason}</p>
                  {selected.reviewComment && (
                    <p className="type-body-sm mt-2 rounded-inner bg-surface-1 px-3 py-2 text-text-secondary">
                      Note: {selected.reviewComment}
                    </p>
                  )}
                  <label htmlFor="triage-note" className="sr-only">
                    Optional triage note
                  </label>
                  <input
                    id="triage-note"
                    type="text"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Add optional triage note…"
                    className="type-body-md mt-3 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 py-2 text-ink shadow-xs placeholder:text-text-muted focus:border-ink"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReview("DISMISSED")}
                      disabled={saving}
                      className="type-label-md inline-flex h-11 items-center rounded-action border border-border-default bg-glass-80 px-6 text-ink backdrop-blur-card hover:bg-surface-2 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview("CONFIRMED")}
                      disabled={saving}
                      className="type-label-md inline-flex h-11 items-center rounded-action border border-border-default bg-glass-80 px-6 text-ink backdrop-blur-card hover:bg-surface-2 disabled:opacity-50"
                    >
                      Confirm impact
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview("RESOLVED")}
                      disabled={saving}
                      className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Mark resolved"}
                    </button>
                  </div>
                  {feedback && (
                    <p className="type-body-sm mt-2 text-positive-micro" role="status">
                      {feedback}
                    </p>
                  )}
                  {reviewError && (
                    <p className="type-body-sm mt-2 text-ink" role="alert">
                      {reviewError}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Graph + path: ~64% on desktop. */}
            <div className="flex min-w-0 flex-1 flex-col gap-4 lg:w-[64%]">
              <section
                aria-label="Selected dependency path"
                className="rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card"
              >
                <h2 className="type-card-title text-ink">Selected dependency path</h2>
                <div className="mt-3">
                  <DependencyGraph
                    nodes={report.graph.nodes}
                    edges={report.graph.edges}
                    selectedNodeIds={selectedNodeIds}
                    selectedEdgeIds={selectedEdgeIds}
                    affectedNodeId={selected?.artifact.id ?? null}
                  />
                </div>
              </section>

              {selected && (
                <section
                  aria-label="Why is this affected"
                  className="rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card"
                >
                  <h2 className="type-card-title text-ink">Why is this affected?</h2>
                  <p className="type-body-sm mt-1 text-text-secondary">{selected.reason}</p>
                  <div className="mt-3">
                    <PathViewer
                      nodes={selected.path.nodes}
                      edges={selected.path.edges}
                      distance={selected.distance}
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
