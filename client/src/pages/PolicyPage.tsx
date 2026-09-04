import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  createImpactRun,
  getPolicy,
  getPolicyGraph,
  getVersionChanges,
  updateClause,
} from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
import DependencyGraph from "../components/DependencyGraph.tsx";
import { ChangeBadge } from "../components/badges.tsx";
import type {
  ClauseChangeDto,
  PolicyDetailDto,
  PolicyGraphDto,
  VersionChangesDto,
} from "../types/index.ts";

function deadlineMention(text: string): string | null {
  const match = text.match(/\d+\s*days?/i);
  return match ? match[0] : null;
}

function MutationLine({ activeText, draftText }: { activeText: string; draftText: string }) {
  const before = deadlineMention(activeText);
  const after = deadlineMention(draftText);
  if (!before || !after || before.toLowerCase() === after.toLowerCase()) return null;
  return (
    <p className="mt-2 text-[13.5px]" aria-label={`Changed from ${before} to ${after}`}>
      <span className="text-stone-400 line-through">{before}</span>
      <span className="mx-1.5 text-stone-400" aria-hidden="true">
        →
      </span>
      <span className="font-semibold text-[#D98B37]">{after}</span>
    </p>
  );
}

export default function PolicyPage() {
  const { policyId = "" } = useParams();
  const navigate = useNavigate();

  const [policy, setPolicy] = useState<PolicyDetailDto | null>(null);
  const [graph, setGraph] = useState<PolicyGraphDto | null>(null);
  const [changes, setChanges] = useState<VersionChangesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const [savingClauseId, setSavingClauseId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const [saveError, setSaveError] = useState("");

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const refreshChanges = useCallback(async (draftVersionId: string) => {
    const fresh = await getVersionChanges(draftVersionId);
    setChanges(fresh);
    setDraftTexts((previous) => {
      const next = { ...previous };
      for (const change of fresh.changes) {
        if (change.draftClause && !(change.draftClause.id in next)) {
          next[change.draftClause.id] = change.draftClause.text;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    Promise.all([getPolicy(policyId), getPolicyGraph(policyId)])
      .then(([detail, policyGraph]) => {
        if (cancelled) return;
        setPolicy(detail);
        setGraph(policyGraph);
        if (detail.draftVersion) {
          refreshChanges(detail.draftVersion.id)
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
      (changes?.changes ?? []).filter(
        (change) => change.changeType === "MODIFIED" || change.changeType === "ADDED",
      ).length,
    [changes],
  );

  const handleSave = async (change: ClauseChangeDto) => {
    if (!policy?.draftVersion || !change.draftClause) return;
    const text = (draftTexts[change.draftClause.id] ?? "").trim();
    if (text.length === 0) {
      setSaveError("Draft text cannot be empty.");
      return;
    }
    setSavingClauseId(change.draftClause.id);
    setSaveError("");
    setSaveNotice("");
    try {
      const updated = await updateClause(policy.draftVersion.id, change.draftClause.id, text);
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
        <div className="mx-auto max-w-5xl rounded-xl border border-[#E6E7E4] bg-white p-5" aria-live="polite">
          <p className="text-sm text-stone-600">Loading policy…</p>
        </div>
      </AppShell>
    );
  }

  if (!policy) {
    return (
      <AppShell breadcrumb="Policies">
        <div className="mx-auto max-w-5xl rounded-xl border border-[#E6E7E4] bg-white p-5" role="alert">
          <p className="text-sm font-semibold text-stone-800">Policy not found</p>
          <p className="mt-1 text-sm text-stone-600">{loadError || "This policy does not exist."}</p>
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

  return (
    <AppShell breadcrumb={`Policies / ${policy.title}`}>
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="text-sm font-medium text-stone-500 hover:text-[#174C3C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
        >
          ← Overview
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold text-stone-900">{policy.title}</h1>
            {policy.description && (
              <p className="mt-1 max-w-2xl text-[14px] text-stone-500">{policy.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="#graph"
              className="rounded-lg border border-[#E6E7E4] bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:border-[#174C3C] hover:text-[#174C3C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
            >
              View graph
            </a>
            <button
              type="button"
              onClick={handleRunImpact}
              disabled={running || !policy.draftVersion || changedCount === 0}
              className="rounded-lg bg-[#174C3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F3529] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
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
          <div className="mt-4 rounded-xl border border-[#E6E7E4] bg-white p-4" role="alert">
            <p className="text-sm text-stone-600">{loadError}</p>
          </div>
        )}

        {runError && (
          <div className="mt-4 rounded-xl border border-[#E6E7E4] bg-white p-4" role="alert">
            <p className="text-sm font-semibold text-stone-800">Impact analysis did not start</p>
            <p className="mt-1 text-sm text-stone-600">{runError}</p>
          </div>
        )}

        {changes && changedCount === 0 && (
          <div className="mt-4 rounded-xl border border-[#E6E7E4] bg-white p-4" aria-live="polite">
            <p className="text-sm text-stone-600">
              No changed clauses. Edit the draft text and save to create a change before running
              impact analysis.
            </p>
          </div>
        )}

        {saveNotice && (
          <p className="mt-4 text-sm font-medium text-[#174C3C]" role="status">
            {saveNotice}
          </p>
        )}
        {saveError && (
          <p className="mt-4 text-sm font-medium text-stone-700" role="alert">
            {saveError}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4">
          {(changes?.changes ?? []).map((change) => {
            const draftValue = change.draftClause
              ? (draftTexts[change.draftClause.id] ?? change.draftClause.text)
              : "";
            const dirty = change.draftClause
              ? draftValue !== change.draftClause.text
              : false;
            return (
              <section
                key={change.stableKey}
                aria-label={`Clause ${change.stableKey}`}
                className="rounded-xl border border-[#E6E7E4] bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[12.5px] font-semibold text-[#174C3C]">
                    {change.stableKey}
                  </p>
                  <ChangeBadge changeType={change.changeType} />
                </div>
                {change.activeClause && change.draftClause && (
                  <MutationLine
                    activeText={change.activeClause.text}
                    draftText={change.draftClause.text}
                  />
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h2 className="text-[11px] font-semibold tracking-wide text-stone-500">
                      ACTIVE VERSION
                    </h2>
                    <div className="mt-2 rounded-lg border border-[#E6E7E4] bg-[#F7F7F5] p-3.5">
                      {change.activeClause ? (
                        <p className="text-[14px] leading-relaxed text-stone-800">
                          {change.activeClause.text}
                        </p>
                      ) : (
                        <p className="text-[13.5px] text-stone-500">
                          No active clause with this key.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-[11px] font-semibold tracking-wide text-stone-500">
                      DRAFT VERSION
                    </h2>
                    {change.draftClause ? (
                      <>
                        <label
                          htmlFor={`draft-${change.draftClause.id}`}
                          className="sr-only"
                        >
                          Draft text for {change.stableKey}
                        </label>
                        <textarea
                          id={`draft-${change.draftClause.id}`}
                          value={draftValue}
                          onChange={(event) =>
                            setDraftTexts((previous) => ({
                              ...previous,
                              [change.draftClause?.id as string]: event.target.value,
                            }))
                          }
                          rows={4}
                          className="mt-2 w-full rounded-lg border border-[#E6E7E4] bg-white p-3.5 text-[14px] leading-relaxed text-stone-800 placeholder:text-stone-400 focus:border-[#174C3C] focus:outline-2 focus:outline-[#174C3C]"
                        />
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleSave(change)}
                            disabled={savingClauseId === change.draftClause.id || !dirty}
                            className="rounded-lg bg-[#174C3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F3529] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
                          >
                            {savingClauseId === change.draftClause.id ? "Saving…" : "Save draft"}
                          </button>
                          {dirty && (
                            <span className="text-[12.5px] text-stone-500">Unsaved edits</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 rounded-lg border border-[#E6E7E4] bg-[#F7F7F5] p-3.5">
                        <p className="text-[13.5px] text-stone-500">
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

        {(!changes || changes.changes.length === 0) && !policy.draftVersion && (
          <div className="mt-4 rounded-xl border border-[#E6E7E4] bg-white p-5">
            <p className="text-sm text-stone-600">
              This policy has no draft version, so there is nothing to compare yet.
            </p>
          </div>
        )}

        <section id="graph" aria-label="Dependency graph" className="mt-6 scroll-mt-6">
          <h2 className="text-[18px] font-semibold text-stone-900">What depends on this clause?</h2>
          <p className="mt-1 text-[13px] text-stone-500">
            Solid lines are approved dependencies. Dashed lines are not yet approved and are
            ignored by impact analysis.
          </p>
          <div className="mt-3 rounded-xl border border-[#E6E7E4] bg-white p-4">
            {graph ? (
              <DependencyGraph nodes={graph.nodes} edges={graph.edges} />
            ) : (
              <p className="text-sm text-stone-500">Graph unavailable.</p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
