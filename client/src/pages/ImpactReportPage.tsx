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
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not reach the API.");
          setLoading(false);
        }
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
        <div className="mx-auto max-w-6xl rounded-xl border border-[#E6E7E4] bg-white p-5" aria-live="polite">
          <p className="text-sm text-stone-600">Loading impact report…</p>
        </div>
      </AppShell>
    );
  }

  if (!report) {
    return (
      <AppShell breadcrumb="Impact Runs">
        <div className="mx-auto max-w-6xl rounded-xl border border-[#E6E7E4] bg-white p-5" role="alert">
          <p className="text-sm font-semibold text-stone-800">Impact run not found</p>
          <p className="mt-1 text-sm text-stone-600">{loadError || "This report does not exist."}</p>
          <Link
            to="/"
            className="mt-3 inline-block rounded-lg px-3 py-1.5 text-sm font-medium text-[#174C3C] hover:bg-[#F0F4F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
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
          className="text-sm font-medium text-stone-500 hover:text-[#174C3C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
        >
          ← Back to policy
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold text-stone-900">Impact analysis</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-stone-500">
              {modifiedChanges.slice(0, 3).map((change) => (
                <span key={change.stableKey} className="inline-flex items-center gap-1.5">
                  <span className="font-mono text-[12px] font-semibold text-[#174C3C]">
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
          <div className="mt-6 rounded-xl border border-[#E6E7E4] bg-white p-5" aria-live="polite">
            <p className="text-sm font-semibold text-stone-800">No affected artifacts</p>
            <p className="mt-1 text-sm text-stone-600">
              The changed clause has no approved downstream dependencies, so there is nothing to
              review.
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4 lg:flex-row">
            {/* Result list: ~36% on desktop, stacked above the graph on narrow screens. */}
            <section
              aria-label="Impacted artifacts"
              className="rounded-xl border border-[#E6E7E4] bg-white p-4 lg:w-[36%] lg:shrink-0"
            >
              <h2 className="px-1 text-[15px] font-semibold text-stone-900">
                Impacted artifacts
              </h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {results.map((result) => {
                  const isSelected = result.id === selectedId;
                  return (
                    <li key={result.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(result.id)}
                        aria-pressed={isSelected}
                        className={`w-full rounded-lg border-l-[3px] px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C] ${
                          isSelected
                            ? "border-l-[#174C3C] bg-[#F0F4F1]"
                            : "border-l-transparent hover:bg-stone-100"
                        }`}
                      >
                        <span
                          className={`block text-[14px] text-stone-800 ${
                            isSelected ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {result.artifact.name}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-stone-500">
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
                <div className="mt-4 border-t border-[#E6E7E4] pt-4">
                  <h3 className="text-[13px] font-semibold text-stone-800">
                    Review: {selected.artifact.name}
                  </h3>
                  <p className="mt-1 text-[12.5px] text-stone-500">{selected.reason}</p>
                  {selected.reviewComment && (
                    <p className="mt-2 rounded-lg bg-stone-100 px-3 py-2 text-[12.5px] text-stone-600">
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
                    className="mt-3 w-full rounded-lg border border-[#E6E7E4] bg-white px-3 py-2 text-[13px] text-stone-700 placeholder:text-stone-400 focus:border-[#174C3C] focus:outline-2 focus:outline-[#174C3C]"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReview("DISMISSED")}
                      disabled={saving}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview("CONFIRMED")}
                      disabled={saving}
                      className="rounded-lg border border-[#174C3C] bg-white px-3 py-1.5 text-sm font-semibold text-[#174C3C] hover:bg-[#F0F4F1] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
                    >
                      Confirm impact
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview("RESOLVED")}
                      disabled={saving}
                      className="rounded-lg bg-[#174C3C] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0F3529] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
                    >
                      {saving ? "Saving…" : "Mark resolved"}
                    </button>
                  </div>
                  {feedback && (
                    <p className="mt-2 text-[12.5px] font-medium text-[#174C3C]" role="status">
                      {feedback}
                    </p>
                  )}
                  {reviewError && (
                    <p className="mt-2 text-[12.5px] font-medium text-stone-700" role="alert">
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
                className="rounded-xl border border-[#E6E7E4] bg-white p-4"
              >
                <h2 className="text-[15px] font-semibold text-stone-900">
                  Selected dependency path
                </h2>
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
                  className="rounded-xl border border-[#E6E7E4] bg-white p-4"
                >
                  <h2 className="text-[15px] font-semibold text-stone-900">
                    Why is this affected?
                  </h2>
                  <p className="mt-1 text-[13px] text-stone-500">{selected.reason}</p>
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
