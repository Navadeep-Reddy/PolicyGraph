import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { createDependency, deleteDependency, getPolicy, getPolicyGraph, listDependencies, listItems, suggestDependencies, updateDependency } from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
import DependencyGraph from "../components/DependencyGraph.tsx";
import { StatusBadge } from "../components/badges.tsx";
import { EmptyState, ErrorState, LoadingState } from "../components/DataStates.tsx";
import type { Dependency, GraphNode, Item, PolicyGraph, RelationshipType } from "../types/index.ts";

const relationTypes: RelationshipType[] = ["GOVERNS", "UPDATES", "APPEARS_IN"];

export default function DependenciesPage() {
  const { policyId = "" } = useParams();
  const [policyTitle, setPolicyTitle] = useState("");
  const [versionId, setVersionId] = useState("");
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [clauses, setClauses] = useState<GraphNode[]>([]);
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
      const [policy, itemRows, edges, network] = await Promise.all([
        getPolicy(policyId), listItems(), listDependencies(policyId), getPolicyGraph(policyId),
      ]);
      const version = policy.versions.find(row => row.status === "DRAFT") ?? policy.versions.find(row => row.status === "ACTIVE");
      if (!version) throw new Error("This policy has no version to review.");
      setPolicyTitle(policy.title); setVersionId(version.id); setItems(itemRows); setDependencies(edges);
      setClauses(network.nodes.filter(node => node.type === "CLAUSE"));
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not load dependencies."); }
    finally { setLoading(false); }
  }, [policyId]);

  useEffect(() => { void load(); }, [load]);

  // Project saved dependency DTOs into display nodes/edges. Impact calculation
  // still runs exclusively on the backend; this only keeps the graph in sync.
  const graph = useMemo<PolicyGraph>(() => {
    const nodes = new Map(clauses.map(node => [node.id, node]));
    const itemById = new Map(items.map(item => [item.id, item]));
    const edges: PolicyGraph["edges"] = [];
    const addItem = (id: string) => {
      const item = itemById.get(id);
      if (item) nodes.set(`artifact:${id}`, { id: `artifact:${id}`, type: "ARTIFACT", label: item.name, subtitle: `${item.type} · ${item.department}` });
    };
    for (const dependency of dependencies) {
      if (dependency.status === "REJECTED" || !itemById.has(dependency.targetArtifactId)) continue;
      const source = dependency.sourceType === "CLAUSE" ? `clause:${dependency.sourceClauseKey}` : `artifact:${dependency.sourceArtifactId}`;
      if (dependency.sourceType === "CLAUSE" ? !nodes.has(source) : !dependency.sourceArtifactId || !itemById.has(dependency.sourceArtifactId)) continue;
      if (dependency.sourceArtifactId) addItem(dependency.sourceArtifactId);
      addItem(dependency.targetArtifactId);
      edges.push({ id: dependency.id, source, target: `artifact:${dependency.targetArtifactId}`, relationshipType: dependency.relationshipType, status: dependency.status });
    }
    return { nodes: [...nodes.values()], edges };
  }, [clauses, items, dependencies]);

  const suggest = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await suggestDependencies(policyId, versionId);
      setDependencies(rows => [...rows, ...result.created.filter(edge => !rows.some(row => row.id === edge.id))]);
      setNotice(`${result.created.length} suggestions added; ${result.skipped} skipped.`);
    }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Dependency suggestions failed."); }
    finally { setBusy(false); }
  };

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const created = await createDependency(policyId, { sourceType, ...(sourceType === "CLAUSE" ? { sourceClauseKey: sourceId } : { sourceArtifactId: sourceId }), targetArtifactId: targetId || items[0]?.id || "", relationshipType });
      setDependencies(rows => [...rows, created]);
      setFormOpen(false); setNotice("Approved dependency added.");
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not add dependency."); }
    finally { setBusy(false); }
  };

  const change = async (dependency: Dependency, patch: { status?: Dependency["status"]; relationshipType?: RelationshipType }) => {
    setBusy(true); setError("");
    setDependencies(rows => rows.map(row => row.id === dependency.id ? { ...row, ...patch } : row));
    try {
      const saved = await updateDependency(dependency.id, patch);
      setDependencies(rows => rows.map(row => row.id === saved.id ? saved : row));
    }
    catch (err: unknown) {
      setDependencies(rows => rows.map(row => row.id === dependency.id ? dependency : row));
      setError(err instanceof Error ? err.message : "Could not update dependency.");
    }
    finally { setBusy(false); }
  };

  const remove = async (dependency: Dependency) => {
    setBusy(true); setError("");
    try { await deleteDependency(dependency.id); setDependencies(rows => rows.filter(row => row.id !== dependency.id)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not remove dependency."); }
    finally { setBusy(false); }
  };

  return <AppShell breadcrumb={`Policies / ${policyTitle || "Dependencies"} / Dependencies`}>
    <Link to={`/policies/${policyId}`} className="type-body-md text-text-muted hover:text-accent">← Back to policy</Link>
    <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="type-label-sm text-accent">Policy workspace · dependency review</p><h1 className="type-page-title mt-2 text-ink">Dependencies</h1><p className="type-body-lg mt-2 text-text-secondary">Review suggested relationships and manage approved policy connections.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void suggest()} disabled={busy || loading || !versionId} className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent disabled:opacity-50">{busy ? "Working…" : "Suggest dependencies"}</button><button type="button" onClick={() => setFormOpen(value => !value)} disabled={busy || loading || !versionId || !items.length} className="type-label-md inline-flex h-11 items-center rounded-action border border-border-default bg-glass-80 px-6 text-ink hover:bg-surface-2">Add dependency</button></div></div>
    {notice && <p role="status" className="type-body-md mt-4 text-positive-micro">{notice}</p>}
    {error && <div className="mt-4"><ErrorState title="Dependency action failed" description={error} action={<button type="button" onClick={() => void load()} className="type-label-md h-11 rounded-action border border-border-default px-6 hover:bg-surface-2">Retry</button>} /></div>}
    {formOpen && <form onSubmit={add} className="mt-5 grid gap-4 rounded-card border border-border-default bg-glass-80 p-5 sm:grid-cols-2"><h2 className="type-item-title sm:col-span-2">Add approved dependency</h2><label className="type-label-sm text-text-muted">Source type<select value={sourceType} onChange={event => { setSourceType(event.target.value as typeof sourceType); setSourceId(""); }} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3"> <option value="CLAUSE">Policy clause</option><option value="ARTIFACT">Operational item</option></select></label><label className="type-label-sm text-text-muted">Source<select required value={sourceId} onChange={event => setSourceId(event.target.value)} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3"><option value="">Select source</option>{sourceType === "CLAUSE" ? clauses.map(clause => <option key={clause.id} value={clause.id.replace(/^clause:/, "")}>{clause.label}</option>) : items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="type-label-sm text-text-muted">Target operational item<select required value={targetId || items[0]?.id || ""} onChange={event => setTargetId(event.target.value)} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3">{items.map(item => <option key={item.id} value={item.id}>{item.name} · {item.department}</option>)}</select></label><label className="type-label-sm text-text-muted">Relationship<select value={relationshipType} onChange={event => setRelationshipType(event.target.value as RelationshipType)} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3">{relationTypes.map(type => <option key={type}>{type}</option>)}</select></label><div className="flex gap-3 sm:col-span-2"><button disabled={busy || !sourceId || items.length === 0} className="type-label-md h-11 rounded-action bg-ink px-7 text-on-dark hover:bg-accent disabled:opacity-50">Add approved dependency</button><button type="button" onClick={() => setFormOpen(false)} className="type-label-md h-11 rounded-action border border-border-default px-6 hover:bg-surface-2">Cancel</button></div></form>}
    <div className="mt-6 flex min-w-0 flex-col gap-6">
      <section aria-labelledby="dependency-list-title" className="min-w-0">
        <h2 id="dependency-list-title" className="type-section-title mb-4 text-ink">Review queue</h2>
        {loading ? <LoadingState message="Loading dependencies…" /> : dependencies.length === 0 ? <EmptyState title="No dependencies yet" description="Suggest relationships with AI or add a known dependency manually." /> : (
          <ul className="flex min-w-0 flex-col gap-3">
            {dependencies.map(edge => (
              <li key={edge.id} className="min-w-0 rounded-card border border-border-default bg-glass-80 p-5 shadow-sm backdrop-blur-card">
                <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={edge.status} /><span className="type-label-sm text-text-muted">{edge.origin}</span></div>
                <p className="type-item-title mt-3 break-words text-ink">{edge.sourceLabel}</p>
                <p className="type-label-sm my-1 text-accent">{edge.relationshipType} →</p>
                <p className="type-body-md break-words text-text-secondary">{edge.targetLabel}</p>
                {edge.rationale && <p className="type-body-sm mt-3 border-l-2 border-accent pl-3 text-text-muted">{edge.rationale}</p>}
                {edge.status === "PROPOSED" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => void change(edge, { status: "APPROVED" })} className="type-label-md h-10 rounded-action bg-ink px-5 text-on-dark hover:bg-accent">Approve</button>
                    <label className="sr-only" htmlFor={`relation-${edge.id}`}>Edit relationship type</label>
                    <select id={`relation-${edge.id}`} disabled={busy} value={edge.relationshipType} onChange={event => void change(edge, { relationshipType: event.target.value as RelationshipType })} className="type-body-sm h-10 rounded-inner border border-border-default bg-surface-white px-2">
                      {relationTypes.map(type => <option key={type}>{type}</option>)}
                    </select>
                    <button type="button" disabled={busy} onClick={() => void change(edge, { status: "REJECTED" })} className="type-label-md h-10 rounded-action border border-border-default px-5 hover:bg-surface-2">Reject</button>
                  </div>
                )}
                <button type="button" disabled={busy} onClick={() => void remove(edge)} className="type-label-sm mt-3 text-text-muted underline underline-offset-2 hover:text-ink">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="dependency-graph-title" className="min-w-0"><h2 id="dependency-graph-title" className="type-section-title mb-4 text-ink">Dependency graph</h2><div className="min-w-0 rounded-panel border border-border-strong bg-glass-90 p-4 shadow-lg">{loading ? <LoadingState message="Loading dependency graph…" /> : <DependencyGraph nodes={graph.nodes} edges={graph.edges} interactiveClauseFocus hideOrphanClauses heightClassName="h-[560px]" />}</div><p className="type-body-sm mt-3 text-text-muted">Solid arrows are approved; dashed arrows are proposed. Select a clause to focus its downstream dependencies. The table below lists visible relationships.</p></section>
    </div>
  </AppShell>;
}
