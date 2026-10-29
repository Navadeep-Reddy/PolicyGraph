import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPolicy, createPolicyFromPdf } from "../api/client.ts";
import { rememberAiProposedClauses } from "../api/clauseProvenance.ts";
import AppShell from "../components/AppShell.tsx";
import { ErrorState } from "../components/DataStates.tsx";

export default function NewPolicyPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"text" | "pdf">("text");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!title.trim()) { setError("Enter a policy title."); return; }
    if (mode === "pdf" && !file) { setError("Select a PDF file to continue."); return; }
    if (mode === "pdf" && !isPdf(file!)) { setError("Select a valid PDF file (application/pdf or .pdf)."); return; }
    if (mode === "pdf" && file!.size > 15 * 1024 * 1024) { setError("The PDF must be 15 MiB or smaller."); return; }
    if (mode === "text" && !text.trim()) { setError("Enter the policy text to continue."); return; }
    setSubmitting(true);
    setError("");
    try {
      const details = { title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) };
      const result = mode === "pdf"
        ? await createPolicyFromPdf({ ...details, file: file! })
        : await createPolicy({ ...details, text: text.trim() });
      rememberAiProposedClauses(result.policy.id, result.draft.clauses.map(clause => clause.id));
      navigate(`/policies/${result.policy.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Policy creation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isPdf = (candidate: File) => candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");
  const selectFile = (candidate: File | undefined, input: HTMLInputElement) => {
    setError("");
    if (!candidate) { setFile(null); return; }
    if (!isPdf(candidate)) { setFile(null); input.value = ""; setError("Select a valid PDF file (application/pdf or .pdf)."); return; }
    if (candidate.size > 15 * 1024 * 1024) { setFile(null); input.value = ""; setError("The PDF must be 15 MiB or smaller."); return; }
    setFile(candidate);
  };

  return (
    <AppShell breadcrumb="Policies / New policy">
      <div className="mx-auto max-w-4xl">
        <p className="type-label-sm text-accent">Policy workspace · new record</p>
        <h1 className="type-page-title mt-2 text-ink">Create a policy</h1>
        <p className="type-body-lg mt-2 max-w-[72ch] text-text-secondary">
          Add policy text or upload a PDF to extract editable clauses for your first draft.
        </p>

        {error && (
          <div className="mt-6">
            <ErrorState
              title="Clause extraction failed"
              description={`${error} No policy was saved. Check the text and API connection, then retry.`}
              action={<button type="submit" form="new-policy-form" disabled={submitting} className="type-label-md inline-flex h-11 items-center rounded-action bg-ink px-7 text-on-dark shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">Retry extraction</button>}
            />
          </div>
        )}

        <form id="new-policy-form" onSubmit={handleSubmit} className="mt-6 rounded-panel border border-border-strong bg-glass-90 p-5 shadow-lg backdrop-blur-panel sm:p-7">
          <div className="grid gap-5">
            <div>
              <label htmlFor="policy-title" className="type-label-sm text-text-muted">Policy title</label>
              <input id="policy-title" name="title" value={title} onChange={event => { setTitle(event.target.value); setError(""); }} required disabled={submitting} maxLength={200} autoComplete="off" className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink shadow-xs focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60" placeholder="e.g. Visitor access policy" />
            </div>
            <div>
              <label htmlFor="policy-description" className="type-label-sm text-text-muted">Description <span className="normal-case tracking-normal">· optional</span></label>
              <input id="policy-description" name="description" value={description} onChange={event => { setDescription(event.target.value); setError(""); }} disabled={submitting} maxLength={1000} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink shadow-xs focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60" placeholder="Brief context for staff reviewing this policy" />
            </div>
            <fieldset disabled={submitting}>
              <legend className="type-label-sm text-text-muted">Policy source</legend>
              <div className="mt-2 flex flex-wrap gap-5">
                <label className="type-body-md inline-flex items-center gap-2 text-ink"><input type="radio" name="policy-mode" value="text" checked={mode === "text"} onChange={() => { setMode("text"); setError(""); }} />Paste policy text</label>
                <label className="type-body-md inline-flex items-center gap-2 text-ink"><input type="radio" name="policy-mode" value="pdf" checked={mode === "pdf"} onChange={() => { setMode("pdf"); setError(""); }} />Upload PDF</label>
              </div>
            </fieldset>
            {mode === "text" ? <div>
              <label htmlFor="policy-text" className="type-label-sm text-text-muted">Policy text</label>
              <textarea id="policy-text" name="text" value={text} onChange={event => { setText(event.target.value); setError(""); }} required minLength={1} rows={12} disabled={submitting} className="type-body-md mt-2 w-full rounded-inner border border-border-default bg-surface-white p-3 text-ink shadow-xs focus-visible:outline-2 focus-visible:outline-accent" placeholder="Paste the policy text here…" />
              <p className="type-body-sm mt-2 text-text-muted">Text is sent to the configured clause-extraction service. Review and edit the extracted clauses before publishing.</p>
            </div> : <div>
              <label htmlFor="policy-pdf" className="type-label-sm text-text-muted">Policy PDF</label>
              <input id="policy-pdf" name="file" type="file" accept=".pdf,application/pdf" required disabled={submitting} onChange={event => selectFile(event.target.files?.[0], event.currentTarget)} aria-describedby="pdf-help pdf-selection" className="type-body-md mt-2 w-full rounded-inner border border-border-default bg-surface-white p-2 text-ink shadow-xs focus-visible:outline-2 focus-visible:outline-accent" />
              <p id="pdf-help" className="type-body-sm mt-2 text-text-muted">PDF text extraction may take a moment. Review and edit extracted clauses before publishing.</p>
              <p id="pdf-selection" role="status" className="type-body-sm mt-1 text-text-muted">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "No PDF selected."}</p>
              {file && <button type="button" disabled={submitting} onClick={() => { setFile(null); const input = document.getElementById("policy-pdf") as HTMLInputElement | null; if (input) input.value = ""; }} className="type-label-md mt-2 h-9 rounded-action border border-border-default bg-surface-white px-4 text-ink hover:bg-surface-2 disabled:opacity-50">Clear and reselect</button>}
            </div>}
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {submitting ? <button type="button" disabled className="type-label-md inline-flex h-11 items-center justify-center rounded-action border border-border-default bg-glass-80 px-6 text-ink disabled:cursor-not-allowed disabled:opacity-50">Cancel</button> : <Link to="/" className="type-label-md inline-flex h-11 items-center justify-center rounded-action border border-border-default bg-glass-80 px-6 text-ink hover:bg-surface-2">Cancel</Link>}
            <button type="submit" disabled={submitting} className="type-label-md inline-flex h-11 items-center justify-center rounded-action bg-ink px-7 text-on-dark shadow-sm transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-60">
              {submitting ? "Extracting clauses…" : "Extract clauses"}
            </button>
          </div>
          {submitting && <p role="status" aria-live="polite" className="type-body-sm mt-4 text-text-muted">Creating a draft and extracting clauses. This may take a moment.</p>}
        </form>
      </div>
    </AppShell>
  );
}
