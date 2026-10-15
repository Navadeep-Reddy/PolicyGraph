import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createImpactRun, getPolicy, getVersion, getVersionChanges } from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
import { ChangeBadge } from "../components/badges.tsx";
import { EmptyState, ErrorState, LoadingState } from "../components/DataStates.tsx";
import type { ClauseChange, PolicyDetail, VersionDetail } from "../types/index.ts";

export default function ComparePage() {
  const { policyId = "" } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [target, setTarget] = useState<VersionDetail | null>(null);
  const [baseId, setBaseId] = useState("");
  const [changes, setChanges] = useState<ClauseChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    getPolicy(policyId).then(async detail => {
      const targetId = search.get("version") ?? detail.versions.find(version => version.status === "DRAFT")?.id ?? detail.versions[0]?.id;
      const targetVersion = targetId ? await getVersion(targetId) : null;
      if (!targetVersion) throw new Error("This policy has no versions to compare.");
      const baseVersion = detail.versions.find(version => version.id === (search.get("against") ?? "")) ?? detail.versions.find(version => version.versionNumber === targetVersion.versionNumber - 1);
      if (!baseVersion) throw new Error("There is no earlier version to compare against.");
      const diff = await getVersionChanges(targetVersion.id, baseVersion.id);
      if (cancelled) return;
      setPolicy(detail); setTarget(targetVersion); setBaseId(baseVersion.id); setChanges(diff);
      const next = new URLSearchParams(search);
      next.set("version", targetVersion.id); next.set("against", baseVersion.id);
      if (next.toString() !== search.toString()) setSearch(next, { replace: true });
    }).catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not compare versions."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [policyId, search, setSearch]);

  const chooseTarget = (id: string) => { const next = new URLSearchParams(search); next.set("version", id); next.delete("against"); setSearch(next); };
  const chooseBase = (id: string) => { const next = new URLSearchParams(search); next.set("against", id); setSearch(next); };
  const run = async () => {
    if (!target) return;
    setRunning(true); setRunError("");
    try { const report = await createImpactRun(target.id); navigate(`/impact-runs/${report.id}`); }
    catch (err: unknown) { setRunError(err instanceof Error ? err.message : "Impact analysis failed."); }
    finally { setRunning(false); }
  };

  const baseVersion = policy?.versions.find(version => version.id === baseId);
  const canRun = target?.status === "DRAFT" && Boolean(baseVersion && policy?.versions.some(version => version.id === baseVersion.id && version.status === "ACTIVE"));
  return <AppShell breadcrumb={`Policies / ${policy?.title ?? "Compare"} / Compare`}>
    <Link to={`/policies/${policyId}`} className="type-body-md text-text-muted hover:text-accent">← Back to policy</Link>
    <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="type-label-sm text-accent">Policy workspace · change review</p><h1 className="type-page-title mt-2 text-ink">Compare versions</h1><p className="type-body-lg mt-2 text-text-secondary">Review clause-level changes before publishing or running impact analysis.</p></div><button type="button" onClick={() => void run()} disabled={!canRun || running || loading} className="type-label-md inline-flex h-11 items-center justify-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent disabled:opacity-50">{running ? "Running analysis…" : "Run impact analysis"}</button></div>
    {runError && <p role="alert" className="type-body-md mt-4 text-ink">{runError}</p>}
    {loading ? <div className="mt-6"><LoadingState message="Loading version comparison…" /></div> : error ? <div className="mt-6"><ErrorState title="Could not load comparison" description={error} action={<Link to={`/policies/${policyId}`} className="type-label-md inline-flex h-11 items-center rounded-action border border-border-default px-6 hover:bg-surface-2">Return to policy</Link>} /></div> : policy && target ? <>
      <div className="mt-6 grid gap-4 rounded-card border border-border-default bg-glass-80 p-5 sm:grid-cols-2"><label className="type-label-sm text-text-muted">Version to review<select value={target.id} onChange={event => chooseTarget(event.target.value)} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3">{policy.versions.map(version => <option key={version.id} value={version.id}>v{version.versionNumber} · {version.status}</option>)}</select></label><label className="type-label-sm text-text-muted">Compare against<select value={baseId} onChange={event => chooseBase(event.target.value)} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3">{policy.versions.filter(version => version.id !== target.id).map(version => <option key={version.id} value={version.id}>v{version.versionNumber} · {version.status}</option>)}</select></label></div>
      <div className="mt-5 flex flex-wrap gap-3">{(["ADDED", "REMOVED", "MODIFIED", "UNCHANGED"] as const).map(type => <span key={type} className="rounded-inner border border-border-faint bg-surface-1 px-3 py-2"><ChangeBadge changeType={type} /> <span className="type-micro-mono ml-2">{changes.filter(row => row.changeType === type).length}</span></span>)}</div>
      {changes.length === 0 ? <div className="mt-5"><EmptyState title="No clauses to compare" description="The selected version has no clauses." /></div> : <div className="mt-5 flex flex-col gap-4">{changes.map(change => <article key={change.stableKey} className="rounded-card border border-border-default bg-glass-80 p-5 shadow-sm backdrop-blur-card"><div className="flex flex-wrap items-center justify-between gap-3"><p className="type-micro-mono uppercase text-accent">{change.stableKey}</p><ChangeBadge changeType={change.changeType} /></div><div className="mt-4 grid gap-4 md:grid-cols-2"><section><h2 className="type-label-sm text-text-muted">{baseVersion ? `Version ${baseVersion.versionNumber}` : "Before"}</h2><p className={`type-body-md mt-2 rounded-inner border border-border-faint bg-surface-white p-4 text-text-secondary ${change.changeType === "REMOVED" ? "line-through" : ""}`}>{change.before?.text ?? "Clause not present"}</p></section><section><h2 className="type-label-sm text-text-muted">Version {target.versionNumber}</h2><p className="type-body-md mt-2 rounded-inner border border-border-faint bg-surface-white p-4 text-text-secondary">{change.after?.text ?? "Clause removed"}</p></section></div></article>)}</div>}
      {!canRun && <p className="type-body-sm mt-4 text-text-muted">Impact analysis is available when comparing the draft against its active predecessor.</p>}
    </> : null}
  </AppShell>;
}
