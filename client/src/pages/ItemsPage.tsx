import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createItem, deleteItem, humanArtifactType, listItems, updateItem } from "../api/client.ts";
import AppShell from "../components/AppShell.tsx";
import { EmptyState, ErrorState, LoadingState } from "../components/DataStates.tsx";
import type { ArtifactType, CreateItemInput, Item } from "../types/index.ts";

const types: ArtifactType[] = ["FORM", "PROCEDURE", "CHECKLIST", "TRAINING_MATERIAL", "DEPARTMENT_INSTRUCTION", "INFORMATION_SHEET"];
const blankForm: CreateItemInput = { name: "", type: "PROCEDURE", department: "", description: "", content: "" };

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<CreateItemInput>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    listItems().then(setItems).catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Could not load operational items.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const edit = (item: Item) => {
    setEditingId(item.id);
    setForm({ name: item.name, type: item.type, department: item.department, description: item.description ?? "", content: item.content ?? "" });
    setError("");
    setNotice("");
    document.getElementById("item-form-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reset = () => { setEditingId(null); setForm(blankForm); setError(""); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    const input = { ...form, name: form.name.trim(), department: form.department.trim(), description: form.description?.trim() || undefined, content: form.content?.trim() || undefined };
    try {
      if (editingId) await updateItem(editingId, input);
      else await createItem(input);
      setNotice(editingId ? "Operational item updated." : "Operational item created.");
      reset(); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not save this operational item."); }
    finally { setSaving(false); }
  };

  const remove = async (item: Item) => {
    setError(""); setNotice("");
    try {
      await deleteItem(item.id);
      setItems(current => current.filter(row => row.id !== item.id));
      if (editingId === item.id) reset();
      setNotice(`${item.name} was deleted. Its dependencies were also removed.`);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Could not delete this item."); }
  };

  return <AppShell breadcrumb="Workspace / Operational items">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="type-label-sm text-accent">Operations · catalog</p><h1 className="type-page-title mt-2 text-ink">Operational items</h1><p className="type-body-lg mt-2 max-w-[72ch] text-text-secondary">Maintain the forms, procedures, checklists, and instructions connected to policy clauses.</p></div>
      <Link to="/policies/new" className="type-label-md inline-flex h-11 items-center justify-center rounded-action border border-border-default bg-glass-80 px-6 text-ink hover:bg-surface-2">Create policy</Link>
    </div>
    {notice && <p role="status" className="type-body-md mt-5 text-positive-micro">{notice}</p>}
    {error && <p role="alert" className="type-body-md mt-3 text-ink">{error}</p>}
    <section className="mt-6 rounded-panel border border-border-strong bg-glass-90 p-5 shadow-lg backdrop-blur-panel sm:p-7" aria-labelledby="item-form-heading">
      <h2 id="item-form-heading" className="type-card-title text-ink">{editingId ? "Edit operational item" : "Add an operational item"}</h2>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="type-label-sm text-text-muted">Name<input required maxLength={200} value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" /></label>
        <label className="type-label-sm text-text-muted">Type<select value={form.type} onChange={event => setForm(value => ({ ...value, type: event.target.value as ArtifactType }))} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink">{types.map(type => <option key={type} value={type}>{humanArtifactType(type)}</option>)}</select></label>
        <label className="type-label-sm text-text-muted">Department<input required maxLength={200} value={form.department} onChange={event => setForm(value => ({ ...value, department: event.target.value }))} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" /></label>
        <label className="type-label-sm text-text-muted">Description · optional<input maxLength={1000} value={form.description ?? ""} onChange={event => setForm(value => ({ ...value, description: event.target.value }))} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink" /></label>
        <label className="type-label-sm text-text-muted sm:col-span-2">Content text · optional<textarea rows={3} value={form.content ?? ""} onChange={event => setForm(value => ({ ...value, content: event.target.value }))} className="type-body-md mt-2 w-full rounded-inner border border-border-default bg-surface-white p-3 text-ink" /></label>
        <div className="flex flex-wrap gap-3 sm:col-span-2"><button disabled={saving} className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark hover:bg-accent disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save changes" : "Add item"}</button>{editingId && <button type="button" onClick={reset} className="type-label-md h-11 rounded-action border border-border-default px-6 hover:bg-surface-2">Cancel edit</button>}</div>
      </form>
    </section>
    <section className="mt-7" aria-labelledby="items-list-heading"><div className="mb-4 flex items-baseline justify-between"><h2 id="items-list-heading" className="type-section-title text-ink">Item catalog</h2><span className="type-micro-mono text-text-muted">{items.length} RECORDS</span></div>
      {loading ? <LoadingState message="Loading operational items…" /> : loadError ? <ErrorState title="Could not load operational items" description={loadError} action={<button type="button" onClick={load} className="type-label-md h-11 rounded-action border border-border-default px-6 hover:bg-surface-2">Retry</button>} /> : items.length === 0 ? <EmptyState title="No operational items yet" description="Add the forms, procedures, or instructions that policies may govern." /> : <div className="overflow-hidden rounded-panel border border-border-strong bg-glass-90 shadow-lg"><div className="overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left"><thead><tr className="border-b border-border-strong"><th className="type-label-md px-4 py-3 text-text-muted">Name</th><th className="type-label-md px-4 py-3 text-text-muted">Type</th><th className="type-label-md px-4 py-3 text-text-muted">Department</th><th className="type-label-md px-4 py-3 text-text-muted">Actions</th></tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-b border-border-faint last:border-0 hover:bg-row-hover"><td className="px-4 py-4"><p className="type-body-md font-semibold text-ink">{item.name}</p>{item.description && <p className="type-body-sm mt-1 text-text-muted">{item.description}</p>}</td><td className="type-body-sm px-4 py-4 text-text-secondary">{humanArtifactType(item.type)}</td><td className="type-body-sm px-4 py-4 text-text-secondary">{item.department}</td><td className="px-4 py-4"><div className="flex gap-2"><button type="button" onClick={() => edit(item)} className="type-label-sm rounded-inner border border-border-default px-3 py-2 hover:bg-surface-2">Edit</button><button type="button" onClick={() => void remove(item)} className="type-label-sm rounded-inner border border-border-default px-3 py-2 hover:bg-surface-2">Delete</button></div></td></tr>)}</tbody></table></div></div>}
    </section>
  </AppShell>;
}
