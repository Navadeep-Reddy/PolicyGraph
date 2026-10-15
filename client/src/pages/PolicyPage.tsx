import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ApiError,
  createClause,
  createRevision,
  createImpactRun,
  deleteClause,
  getPolicy,
  getPolicyGraph,
  getVersion,
  getVersionChanges,
  publishVersion,
  updateClause,
} from "../api/client.ts";
import { clearAiProposedClauses, getAiProposedClauseIds } from "../api/clauseProvenance.ts";
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
  selectedVersion: VersionDetail | null;
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
  const [searchParams] = useSearchParams();
  const selectedVersionId = searchParams.get("version");

  const [policy, setPolicy] = useState<PolicyView | null>(null);
  const [graph, setGraph] = useState<PolicyGraph | null>(null);
  const [changes, setChanges] = useState<ClauseChange[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [draftValues, setDraftValues] = useState<Record<string, { title: string; text: string; category: string }>>({});
  const [savingClauseId, setSavingClauseId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const [saveError, setSaveError] = useState("");

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [addingClause, setAddingClause] = useState(false);
  const [newClause, setNewClause] = useState({ stableKey: "", title: "", text: "", category: "" });
  const [aiProposedIds, setAiProposedIds] = useState<Set<string>>(() => getAiProposedClauseIds(policyId));
  const [standaloneEdits, setStandaloneEdits] = useState<Record<string, { title: string; text: string; category: string }>>({});

  const refreshChanges = useCallback(async (draftVersionId: string, isCurrent: () => boolean = () => true) => {
    const fresh = await getVersionChanges(draftVersionId);
    if (!isCurrent()) return;
    setChanges(fresh);
    setDraftValues((previous) => {
      const next = { ...previous };
      for (const change of fresh) {
        if (change.after && !(change.after.id in next)) {
          next[change.after.id] = { title: change.after.title, text: change.after.text, category: change.after.category };
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
    setDraftValues({});
    setAiProposedIds(getAiProposedClauseIds(policyId));
    getPolicy(policyId)
      .then(async (detail) => {
        const active = detail.versions.find(version => version.status === "ACTIVE");
        const draft = detail.versions.find(version => version.status === "DRAFT");
        const [activeVersion, draftVersion, requestedVersion] = await Promise.all([
          active ? getVersion(active.id) : null,
          draft ? getVersion(draft.id) : null,
          selectedVersionId && detail.versions.some(version => version.id === selectedVersionId)
            ? getVersion(selectedVersionId)
            : null,
        ]);
        if (cancelled) return;
        setPolicy({ ...detail, activeVersion, draftVersion, selectedVersion: requestedVersion ?? draftVersion ?? activeVersion });
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
  }, [policyId, refreshChanges, refreshToken, selectedVersionId]);

  const handleCreateRevision = async () => {
    setActionBusy(true);
    setActionError("");
    try {
      const revision = await createRevision(policyId);
      navigate(`/policies/${policyId}?version=${revision.id}`);
      setRefreshToken(value => value + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not create a revision.");
    } finally {
      setActionBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!policy?.draftVersion) return;
    setActionBusy(true);
    setActionError("");
    try {
      await publishVersion(policy.draftVersion.id);
      clearAiProposedClauses(policyId);
      setAiProposedIds(new Set());
      setRefreshToken(value => value + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not publish this version.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddClause = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!policy?.draftVersion) return;
    setActionBusy(true);
    setActionError("");
    try {
      await createClause(policy.draftVersion.id, {
        stableKey: newClause.stableKey.trim(), title: newClause.title.trim(),
        text: newClause.text.trim(), category: newClause.category.trim(),
      });
      setNewClause({ stableKey: "", title: "", text: "", category: "" });
      setAddingClause(false);
      setRefreshToken(value => value + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not add the clause.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteClause = async (clauseId: string) => {
    if (!policy?.draftVersion) return;
    setActionBusy(true);
    setActionError("");
    try {
      await deleteClause(policy.draftVersion.id, clauseId);
      setRefreshToken(value => value + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not delete the clause.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveStandaloneClause = async (clauseId: string) => {
    if (!policy?.draftVersion) return;
    const clause = policy.draftVersion.clauses.find(row => row.id === clauseId);
    if (!clause) return;
    const draft = standaloneEdits[clauseId] ?? clause;
    setActionBusy(true); setActionError("");
    try {
      await updateClause(policy.draftVersion.id, clauseId, { title: draft.title.trim(), text: draft.text.trim(), category: draft.category.trim() });
      setStandaloneEdits(previous => { const next = { ...previous }; delete next[clauseId]; return next; });
      setRefreshToken(value => value + 1);
    } catch (err: unknown) { setActionError(err instanceof Error ? err.message : "Could not save this clause."); }
    finally { setActionBusy(false); }
  };

  const changedCount = useMemo(
    () =>
      (changes ?? []).filter(
        (change) => change.changeType === "MODIFIED" || change.changeType === "REMOVED",
      ).length,
    [changes],
  );

  const handleSave = async (change: ClauseChange) => {
    if (!policy?.draftVersion || !change.after) return;
    const value = draftValues[change.after.id] ?? change.after;
    const title = value.title.trim();
    const text = value.text.trim();
    const category = value.category.trim();
    if (!title || !text || !category) {
      setSaveError("Clause title, text, and category are required.");
      return;
    }
    setSavingClauseId(change.after.id);
    setSaveError("");
    setSaveNotice("");
    try {
      const updated = await updateClause(policy.draftVersion.id, change.after.id, { title, text, category });
      setDraftValues((previous) => ({ ...previous, [updated.id]: { title: updated.title, text: updated.text, category: updated.category } }));
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
            {policy.draftVersion ? <button type="button" onClick={handlePublish} disabled={actionBusy || policy.draftVersion.clauses.length === 0} className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">{actionBusy ? "Saving…" : "Publish version"}</button> : <button type="button" onClick={handleCreateRevision} disabled={actionBusy || !policy.activeVersion} className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">{actionBusy ? "Creating…" : "Create revision"}</button>}
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

        <section aria-labelledby="versions-heading" className="mt-6 rounded-card border border-border-default bg-glass-80 p-5 shadow-sm backdrop-blur-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="versions-heading" className="type-item-title text-ink">Versions</h2>
              <p className="type-body-sm mt-1 text-text-muted">Policy history and current draft.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {policy.versions.map(version => <Link key={version.id} to={`/policies/${policyId}?version=${version.id}`} aria-current={policy.selectedVersion?.id === version.id ? "page" : undefined} className={`inline-flex items-center gap-2 rounded-inner border px-3 py-2 hover:bg-surface-2 ${policy.selectedVersion?.id === version.id ? "border-border-strong bg-surface-2" : "border-border-default bg-surface-white"}`}><span className="type-micro-mono">v{version.versionNumber}</span><span className="type-label-sm text-text-muted">{version.status}</span></Link>)}
            </div>
          </div>
        </section>

        {policy.selectedVersion && (
          <section className="mt-4 rounded-card border border-border-default bg-glass-80 p-5 shadow-sm backdrop-blur-card" aria-labelledby="selected-version-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="selected-version-heading" className="type-item-title text-ink">Version {policy.selectedVersion.versionNumber} clauses</h2>
              <span className="type-label-sm text-text-muted">{policy.selectedVersion.status}</span>
            </div>
            {policy.selectedVersion.clauses.length ? <ul className="mt-4 divide-y divide-border-faint">{policy.selectedVersion.clauses.map(clause => {
              const canEdit = policy.draftVersion?.id === policy.selectedVersion?.id;
              const value = standaloneEdits[clause.id] ?? { title: clause.title, text: clause.text, category: clause.category };
              const dirty = value.title !== clause.title || value.text !== clause.text || value.category !== clause.category;
              const update = (key: "title" | "text" | "category", nextValue: string) => setStandaloneEdits(previous => ({ ...previous, [clause.id]: { ...(previous[clause.id] ?? clause), [key]: nextValue } }));
              return <li key={clause.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="type-micro-mono uppercase text-accent">{clause.stableKey} · {value.category}</p><div className="flex items-center gap-2">{policy.selectedVersion?.status === "DRAFT" && aiProposedIds.has(clause.id) && <span className="type-label-sm inline-flex items-center gap-2 rounded-chip border border-dashed border-border-strong bg-surface-2 px-3 py-1 text-accent">AI-proposed</span>}{canEdit && <button type="button" onClick={() => void handleDeleteClause(clause.id)} disabled={actionBusy} className="type-label-sm rounded-inner border border-border-default px-3 py-2 hover:bg-surface-2">Delete</button>}</div></div>{canEdit ? <div className="mt-2 grid gap-3"><label className="type-label-sm text-text-muted">Title<input value={value.title} onChange={event => update("title", event.target.value)} className="type-body-md mt-1 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" /></label><label className="type-label-sm text-text-muted">Category<input value={value.category} onChange={event => update("category", event.target.value)} className="type-body-md mt-1 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" /></label><label className="type-label-sm text-text-muted">Clause text<textarea rows={3} value={value.text} onChange={event => update("text", event.target.value)} className="type-body-md mt-1 w-full rounded-inner border border-border-default bg-surface-white p-3 text-ink" /></label><div><button type="button" onClick={() => void handleSaveStandaloneClause(clause.id)} disabled={!dirty || actionBusy} className="type-label-md inline-flex h-10 items-center rounded-action bg-ink px-6 text-on-dark hover:bg-accent disabled:opacity-50">Save clause</button></div></div> : <><h3 className="type-item-title mt-1 text-ink">{clause.title}</h3><p className="type-body-md mt-2 text-text-secondary">{clause.text}</p></>}</li>;
            })}</ul> : <p className="type-body-md mt-4 text-text-muted">This version has no clauses.</p>}
          </section>
        )}

        {actionError && <div role="alert" className="mt-4 rounded-card border border-border-strong border-l-2 border-l-ink bg-surface-white p-4"><p className="type-label-sm">Action could not be completed</p><p className="type-body-md mt-1 text-text-secondary">{actionError}</p></div>}

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
            const draftValue = change.after ? (draftValues[change.after.id] ?? change.after) : null;
            const dirty = Boolean(change.after && draftValue && (draftValue.title !== change.after.title || draftValue.text !== change.after.text || draftValue.category !== change.after.category));
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

                {policy.draftVersion && change.after && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="type-label-sm text-accent">Draft clause</p>
                    <button type="button" onClick={() => handleDeleteClause(change.after!.id)} disabled={actionBusy} className="type-label-sm rounded-inner border border-border-default bg-glass-80 px-3 py-2 text-ink hover:bg-surface-2 disabled:opacity-50">Delete clause</button>
                  </div>
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
                        <label htmlFor={`title-${change.after.id}`} className="type-label-sm text-text-muted">Clause title</label>
                        <input id={`title-${change.after.id}`} value={draftValue?.title ?? change.after.title} onChange={event => setDraftValues(previous => ({ ...previous, [change.after!.id]: { ...(previous[change.after!.id] ?? change.after!), title: event.target.value } }))} className="type-body-md mt-1 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" />
                        <label htmlFor={`category-${change.after.id}`} className="type-label-sm mt-3 block text-text-muted">Category</label>
                        <input id={`category-${change.after.id}`} value={draftValue?.category ?? change.after.category} onChange={event => setDraftValues(previous => ({ ...previous, [change.after!.id]: { ...(previous[change.after!.id] ?? change.after!), category: event.target.value } }))} className="type-body-md mt-1 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" />
                        <label htmlFor={`draft-${change.after.id}`} className="type-label-sm mt-3 block text-text-muted">Clause text</label>
                        <textarea
                          id={`draft-${change.after.id}`}
                          value={draftValue?.text ?? change.after.text}
                          onChange={(event) =>
                            setDraftValues((previous) => ({
                              ...previous,
                              [change.after!.id]: { ...(previous[change.after!.id] ?? change.after!), text: event.target.value },
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

        {policy.draftVersion && (
          <section className="mt-5 rounded-card border border-border-default bg-glass-80 p-5 shadow-sm backdrop-blur-card" aria-labelledby="add-clause-heading">
            {!addingClause ? <button type="button" onClick={() => setAddingClause(true)} className="type-label-md inline-flex h-11 items-center rounded-action border border-border-default bg-glass-80 px-6 text-ink hover:bg-surface-2">Add clause</button> : <form onSubmit={handleAddClause} className="grid gap-4">
              <h2 id="add-clause-heading" className="type-item-title">Add a draft clause</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="type-label-sm text-text-muted">Stable key<input required value={newClause.stableKey} onChange={event => setNewClause(value => ({ ...value, stableKey: event.target.value }))} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" /></label>
                <label className="type-label-sm text-text-muted">Title<input required value={newClause.title} onChange={event => setNewClause(value => ({ ...value, title: event.target.value }))} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" /></label>
                <label className="type-label-sm text-text-muted sm:col-span-2">Category<input required value={newClause.category} onChange={event => setNewClause(value => ({ ...value, category: event.target.value }))} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" /></label>
                <label className="type-label-sm text-text-muted sm:col-span-2">Clause text<textarea required rows={4} value={newClause.text} onChange={event => setNewClause(value => ({ ...value, text: event.target.value }))} className="type-body-md mt-2 w-full rounded-inner border border-border-default bg-surface-white p-3 text-ink" /></label>
              </div>
              <div className="flex flex-wrap gap-3"><button type="submit" disabled={actionBusy} className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark hover:bg-accent disabled:opacity-50">Add clause</button><button type="button" onClick={() => setAddingClause(false)} className="type-label-md h-11 rounded-action border border-border-default px-6 hover:bg-surface-2">Cancel</button></div>
            </form>}
          </section>
        )}

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
