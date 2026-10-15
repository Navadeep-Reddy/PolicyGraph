import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { createDependency, deleteDependency, getPolicy, getPolicyGraph, listDependencies, listItems, suggestDependencies, updateDependency } from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
import DependencyGraph from "../components/DependencyGraph.tsx";
import { StatusBadge } from "../components/badges.tsx";
import { EmptyState, ErrorState, LoadingState } from "../components/DataStates.tsx";
import type { Dependency, Item, PolicyGraph, RelationshipType } from "../types/index.ts";

const relationTypes: RelationshipType[] = ["GOVERNS", "UPDATES", "APPEARS_IN"];

export default function DependenciesPage() {
  const { policyId = "" } = useParams();
  const [policyTitle, setPolicyTitle] = useState("");
  const [versionId, setVersionId] = useState("");
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [graph, setGraph] = useState<PolicyGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [sourceType, setSourceType] = useState<"CLAUSE" | "ARTIFACT">("CLAUSE");
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("GOVERNS");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [policy, itemRows] = await Promise.all([getPolicy(policyId), listItems()]);
      const version = policy.versions.find(row => row.status === "DRAFT") ?? policy.versions.find(row => row.status === "ACTIVE");
      if (!version) throw new Error("This policy has no version to review.");
      const [edges, network] = await Promise.all([listDependencies(policyId), getPolicyGraph(policyId, version.id)]);
      setPolicyTitle(policy.title); setVersionId(version.id); setItems(itemRows); setDependencies(edges); setGraph(network);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not load dependencies."); }
    finally { setLoading(false); }
  }, [policyId]);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    const [edges, network] = await Promise.all([listDependencies(policyId), getPolicyGraph(policyId, versionId)]);
    setDependencies(edges); setGraph(network);
  };

  const suggest = async () => {
    setBusy(true); setError(""); setNotice("");
    try { const result = await suggestDependencies(policyId, versionId); await refresh(); setNotice(`${result.created.length} suggestions added; ${result.skipped} skipped.`); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Dependency suggestions failed."); }
    finally { setBusy(false); }
  };

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await createDependency(policyId, { sourceType, ...(sourceType === "CLAUSE" ? { sourceClauseKey: sourceId } : { sourceArtifactId: sourceId }), targetArtifactId: targetId || items[0]?.id || "", relationshipType });
      setFormOpen(false); await refresh(); setNotice("Approved dependency added.");
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not add dependency."); }
    finally { setBusy(false); }
  };

  const change = async (dependency: Dependency, patch: { status?: Dependency["status"]; relationshipType?: RelationshipType }) => {
    setBusy(true); setError("");
    try { await updateDependency(dependency.id, patch); await refresh(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not update dependency."); }
    finally { setBusy(false); }
  };

  const remove = async (dependency: Dependency) => {
    setBusy(true); setError("");
    try { await deleteDependency(dependency.id); await refresh(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not remove dependency."); }
    finally { setBusy(false); }
  };

  const clauses = graph.nodes.filter(node => node.type === "CLAUSE");
  return <AppShell breadcrumb={`Policies / ${policyTitle || "Dependencies"} / Dependencies`}>
    <Link to={`/policies/${policyId}`} className="type-body-md text-text-muted hover:text-accent">← Back to policy</Link>
    <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="type-label-sm text-accent">Policy workspace · dependency review</p><h1 className="type-page-title mt-2 text-ink">Dependencies</h1><p className="type-body-lg mt-2 text-text-secondary">Review suggested relationships and manage approved policy connections.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void suggest()} disabled={busy || !versionId} className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent disabled:opacity-50">{busy ? "Working…" : "Suggest dependencies"}</button><button type="button" onClick={() => setFormOpen(value => !value)} disabled={!versionId || !items.length} className="type-label-md inline-flex h-11 items-center rounded-action border border-border-default bg-glass-80 px-6 text-ink hover:bg-surface-2">Add dependency</button></div></div>
    {notice && <p role="status" className="type-body-md mt-4 text-positive-micro">{notice}</p>}
    {error && <div className="mt-4"><ErrorState title="Dependency action failed" description={error} action={<button type="button" onClick={() => void load()} className="type-label-md h-11 rounded-action border border-border-default px-6 hover:bg-surface-2">Retry</button>} /></div>}
    {formOpen && <form onSubmit={add} className="mt-5 grid gap-4 rounded-card border border-border-default bg-glass-80 p-5 sm:grid-cols-2"><h2 className="type-item-title sm:col-span-2">Add approved dependency</h2><label className="type-label-sm text-text-muted">Source type<select value={sourceType} onChange={event => { setSourceType(event.target.value as typeof sourceType); setSourceId(""); }} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3"> <option value="CLAUSE">Policy clause</option><option value="ARTIFACT">Operational item</option></select></label><label className="type-label-sm text-text-muted">Source<select required value={sourceId} onChange={event => setSourceId(event.target.value)} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3"><option value="">Select source</option>{sourceType === "CLAUSE" ? clauses.map(clause => <option key={clause.id} value={clause.id.replace(/^clause:/, "")}>{clause.label}</option>) : items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="type-label-sm text-text-muted">Target operational item<select required value={targetId || items[0]?.id || ""} onChange={event => setTargetId(event.target.value)} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3">{items.map(item => <option key={item.id} value={item.id}>{item.name} · {item.department}</option>)}</select></label><label className="type-label-sm text-text-muted">Relationship<select value={relationshipType} onChange={event => setRelationshipType(event.target.value as RelationshipType)} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3">{relationTypes.map(type => <option key={type}>{type}</option>)}</select></label><div className="flex gap-3 sm:col-span-2"><button disabled={busy || !sourceId || items.length === 0} className="type-label-md h-11 rounded-action bg-ink px-7 text-on-dark hover:bg-accent disabled:opacity-50">Add approved dependency</button><button type="button" onClick={() => setFormOpen(false)} className="type-label-md h-11 rounded-action border border-border-default px-6 hover:bg-surface-2">Cancel</button></div></form>}
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.25fr]">
      <section aria-labelledby="dependency-list-title"><h2 id="dependency-list-title" className="type-section-title mb-4 text-ink">Review queue</h2>{loading ? <LoadingState message="Loading dependencies…" /> : dependencies.length === 0 ? <EmptyState title="No dependencies yet" description="Suggest relationships with AI or add a known dependency manually." /> : <ul className="flex flex-col gap-3">{dependencies.map(edge => <li key={edge.id} className="rounded-card border border-border-default bg-glass-80 p-5 shadow-sm backdrop-blur-card"><div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={edge.status} /><span className="type-label-sm text-text-muted">{edge.origin}</span></div><p className="type-item-title mt-3 text-ink">{edge.sourceLabel}</p><p className="type-label-sm my-1 text-accent">{edge.relationshipType} →</p><p className="type-body-md text-text-secondary">{edge.targetLabel}</p>{edge.rationale && <p className="type-body-sm mt-3 border-l-2 border-accent pl-3 text-text-muted">{edge.rationale}</p>}{edge.status === "PROPOSED" && <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void change(edge, { status: "APPROVED" })} className="type-label-md h-10 rounded-action bg-ink px-5 text-on-dark hover:bg-accent">Approve</button><label className="sr-only" htmlFor={`relation-${edge.id}`}>Edit relationship type</label><select id={`relation-${edge.id}`} value={edge.relationshipType} onChange={event => void change(edge, { relationshipType: event.target.value as RelationshipType })} className="type-body-sm h-10 rounded-inner border border-border-default bg-surface-white px-2">{relationTypes.map(type => <option key={type}>{type}</option>)}</select><button type="button" disabled={busy} onClick={() => void change(edge, { status: "REJECTED" })} className="type-label-md h-10 rounded-action border border-border-default px-5 hover:bg-surface-2">Reject</button></div>}<button type="button" disabled={busy} onClick={() => void remove(edge)} className="type-label-sm mt-3 text-text-muted underline underline-offset-2 hover:text-ink">Remove</button></li>)}</ul>}</section>
      <section aria-labelledby="dependency-graph-title"><h2 id="dependency-graph-title" className="type-section-title mb-4 text-ink">Dependency graph</h2><div className="rounded-panel border border-border-strong bg-glass-90 p-4 shadow-lg">{loading ? <LoadingState message="Loading dependency graph…" /> : <DependencyGraph nodes={graph.nodes} edges={graph.edges} />}</div><p className="type-body-sm mt-3 text-text-muted">Solid lines are approved. Dashed lines are proposed. The table below the graph lists each visible relationship.</p></section>
    </div>
  </AppShell>;
}
