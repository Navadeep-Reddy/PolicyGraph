import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createImpactRun,
  getPolicy,
  getPolicyGraph,
  getVersion,
  getVersionChanges,
  updateClause,
} from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
import DependencyGraph from "../components/DependencyGraph.tsx";
import { ChangeBadge } from "../components/badges.tsx";
import { ErrorState, LoadingState } from "../components/DataStates.tsx";
import type {
  ClauseChange,
  PolicyDetail,
  PolicyGraph,
  VersionDetail,
} from "../types/index.ts";

interface PolicyView extends PolicyDetail {
  activeVersion: VersionDetail | null;
  draftVersion: VersionDetail | null;
}

function deadlineMention(text: string): string | null {
  const match = text.match(/\d+\s*days?/i);
  return match ? match[0] : null;
}

function MutationLine({ activeText, draftText }: { activeText: string; draftText: string }) {
  const before = deadlineMention(activeText);
  const after = deadlineMention(draftText);
  if (!before || !after || before.toLowerCase() === after.toLowerCase()) return null;
  return (
    <p className="type-body-md mt-2" aria-label={`Changed from ${before} to ${after}`}>
      <span className="text-text-muted line-through">{before}</span>
      <span className="mx-1.5 text-text-muted" aria-hidden="true">
        →
      </span>
      <span className="text-sm font-semibold text-accent">{after}</span>
    </p>
  );
}

export default function PolicyPage() {
  const { policyId = "" } = useParams();
  const navigate = useNavigate();

  const [policy, setPolicy] = useState<PolicyView | null>(null);
  const [graph, setGraph] = useState<PolicyGraph | null>(null);
  const [changes, setChanges] = useState<ClauseChange[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const [savingClauseId, setSavingClauseId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const [saveError, setSaveError] = useState("");

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const refreshChanges = useCallback(async (draftVersionId: string, isCurrent: () => boolean = () => true) => {
    const fresh = await getVersionChanges(draftVersionId);
    if (!isCurrent()) return;
    setChanges(fresh);
    setDraftTexts((previous) => {
      const next = { ...previous };
      for (const change of fresh) {
        if (change.after && !(change.after.id in next)) {
          next[change.after.id] = change.after.text;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setPolicy(null);
    setChanges(null);
    setGraph(null);
    setDraftTexts({});
    getPolicy(policyId)
      .then(async (detail) => {
        const active = detail.versions.find(version => version.status === "ACTIVE");
        const draft = detail.versions.find(version => version.status === "DRAFT");
        const [activeVersion, draftVersion] = await Promise.all([
          active ? getVersion(active.id) : null,
          draft ? getVersion(draft.id) : null,
        ]);
        if (cancelled) return;
        setPolicy({ ...detail, activeVersion, draftVersion });
        if (activeVersion || draftVersion) {
          getPolicyGraph(policyId).then(value => { if (!cancelled) setGraph(value); }).catch((err: unknown) => {
            if (!cancelled) setLoadError(err instanceof Error ? `Graph unavailable: ${err.message}` : "Graph unavailable.");
          });
        }
        if (draftVersion) {
          refreshChanges(draftVersion.id, () => !cancelled)
            .then(() => {
              if (!cancelled) setLoading(false);
            })
            .catch((err: unknown) => {
              if (!cancelled) {
                // Change detection failing must not hide the comparison screen.
                setChanges(null);
                setLoadError(
                  err instanceof Error ? `Policy loaded, but changes failed: ${err.message}` : "",
                );
                setLoading(false);
              }
            });
        } else {
          setLoading(false);
        }
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
  }, [policyId, refreshChanges]);

  const changedCount = useMemo(
    () =>
      (changes ?? []).filter(
        (change) => change.changeType === "MODIFIED" || change.changeType === "REMOVED",
      ).length,
    [changes],
  );

  const handleSave = async (change: ClauseChange) => {
    if (!policy?.draftVersion || !change.after) return;
    const text = (draftTexts[change.after.id] ?? "").trim();
    if (text.length === 0) {
      setSaveError("Draft text cannot be empty.");
      return;
    }
    setSavingClauseId(change.after.id);
    setSaveError("");
    setSaveNotice("");
    try {
      const updated = await updateClause(policy.draftVersion.id, change.after.id, { text });
      setDraftTexts((previous) => ({ ...previous, [updated.id]: updated.text }));
      await refreshChanges(policy.draftVersion.id);
      setSaveNotice("Draft saved.");
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Saving the draft failed.");
    } finally {
      setSavingClauseId(null);
    }
  };

  const handleRunImpact = async () => {
    if (!policy?.draftVersion) return;
    setRunning(true);
    setRunError("");
    try {
      const report = await createImpactRun(policy.draftVersion.id);
      navigate(`/impact-runs/${report.id}`);
    } catch (err: unknown) {
      setRunError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Impact analysis failed.",
      );
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumb="Policies">
        <LoadingState message="Loading policy…" />
      </AppShell>
    );
  }

  if (!policy) {
    return (
      <AppShell breadcrumb="Policies">
        <ErrorState title="Could not load policy" description={`${loadError || "This policy does not exist."} Return to the dashboard and open a policy.`} action={<Link
            to="/"
            className="type-body-md mt-3 inline-block px-3 py-1.5 text-accent hover:bg-surface-2"
          >
            ← Back to overview
          </Link>} />
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb={`Policies / ${policy.title}`}>
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="type-body-md text-text-muted hover:text-accent"
        >
          ← Overview
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="type-page-title text-ink">{policy.title}</h1>
            {policy.description && (
              <p className="type-body-md mt-1 max-w-2xl text-text-secondary">
                {policy.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="#graph"
              className="type-label-md inline-flex h-11 items-center rounded-action border border-border-default bg-glass-80 px-6 text-ink backdrop-blur-card hover:bg-surface-2"
            >
              View graph
            </a>
            <button
              type="button"
              onClick={handleRunImpact}
              disabled={running || !policy.draftVersion || changedCount === 0}
              className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              title={
                changedCount === 0
                  ? "Edit the draft to create a change before running analysis"
                  : "Run impact analysis"
              }
            >
              {running ? "Running…" : "Run impact analysis"}
            </button>
          </div>
        </div>

        {loadError && (
          <div
            className="mt-4 rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card"
            role="alert"
          >
            <p className="type-body-md text-text-secondary">{loadError}</p>
          </div>
        )}

        {runError && (
          <div
            className="mt-4 rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card"
            role="alert"
          >
            <p className="type-item-title text-ink">Impact analysis did not start</p>
            <p className="type-body-md mt-1 text-text-secondary">{runError}</p>
          </div>
        )}

        {changes && changedCount === 0 && (
          <div
            className="mt-4 rounded-card border border-border-default bg-panel-low-70 p-4 backdrop-blur-card"
            aria-live="polite"
          >
            <p className="type-body-md text-text-secondary">
              No changed clauses. Edit the draft text and save to create a change before running
              impact analysis.
            </p>
          </div>
        )}

        {saveNotice && (
          <p className="type-body-md mt-4 text-positive-micro" role="status">
            {saveNotice}
          </p>
        )}
        {saveError && (
          <p className="type-body-md mt-4 text-ink" role="alert">
            {saveError}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4">
          {(changes ?? []).map((change) => {
            const draftValue = change.after
              ? (draftTexts[change.after.id] ?? change.after.text)
              : "";
            const dirty = change.after
              ? draftValue !== change.after.text
              : false;
            return (
              <section
                key={change.stableKey}
                aria-label={`Clause ${change.stableKey}`}
                className="rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="type-micro-mono uppercase text-accent">
                    {change.stableKey}
                  </p>
                  <ChangeBadge changeType={change.changeType} />
                </div>
                {change.before && change.after && (
                  <MutationLine
                    activeText={change.before.text}
                    draftText={change.after.text}
                  />
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h2 className="type-label-sm text-text-muted">Active version</h2>
                    <div className="mt-2 rounded-inner border border-border-faint bg-surface-1 p-3.5">
                      {change.before ? (
                        <p className="type-body-md text-ink">{change.before.text}</p>
                      ) : (
                        <p className="type-body-sm text-text-muted">
                          No active clause with this key.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="type-label-sm text-text-muted">Draft version</h2>
                    {change.after ? (
                      <>
                        <label
                          htmlFor={`draft-${change.after.id}`}
                          className="sr-only"
                        >
                          Draft text for {change.stableKey}
                        </label>
                        <textarea
                          id={`draft-${change.after.id}`}
                          value={draftValue}
                          onChange={(event) =>
                            setDraftTexts((previous) => ({
                              ...previous,
                              [change.after?.id as string]: event.target.value,
                            }))
                          }
                          rows={4}
                          className="type-body-md mt-2 w-full rounded-inner border border-border-default bg-surface-white p-3.5 text-ink shadow-xs placeholder:text-text-muted focus:border-ink"
                        />
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleSave(change)}
                            disabled={savingClauseId === change.after.id || !dirty}
                            className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingClauseId === change.after.id ? "Saving…" : "Save draft"}
                          </button>
                          {dirty && (
                            <span className="type-body-sm text-text-muted">Unsaved edits</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 rounded-inner border border-border-faint bg-surface-1 p-3.5">
                        <p className="type-body-sm text-text-muted">
                          Removed in draft — nothing to edit.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {(!changes || changes.length === 0) && !policy.draftVersion && (
          <div className="mt-4 rounded-card border border-border-default bg-glass-80 p-7 shadow-sm backdrop-blur-card">
            <p className="type-body-md text-text-secondary">
              This policy has no draft version, so there is nothing to compare yet.
            </p>
          </div>
        )}

        <section id="graph" aria-label="Dependency graph" className="mt-6 scroll-mt-6">
          <h2 className="type-item-title text-ink">What depends on this clause?</h2>
          <p className="type-body-sm mt-1 text-text-muted">
            Solid lines are approved dependencies. Dashed lines are not yet approved and are
            ignored by impact analysis.
          </p>
          <div className="mt-3 rounded-panel border border-border-strong bg-glass-90 p-4 shadow-lg backdrop-blur-panel">
            {graph ? (
              <DependencyGraph nodes={graph.nodes} edges={graph.edges} />
            ) : (
              <p className="type-body-md text-text-muted">Graph unavailable.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
