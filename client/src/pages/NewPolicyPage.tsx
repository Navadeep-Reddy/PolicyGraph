import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPolicy } from "../api/client.ts";
import { rememberAiProposedClauses } from "../api/clauseProvenance.ts";
import AppShell from "../components/AppShell.tsx";
import { ErrorState } from "../components/DataStates.tsx";

export default function NewPolicyPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await createPolicy({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        text: text.trim(),
      });
      rememberAiProposedClauses(result.policy.id, result.draft.clauses.map(clause => clause.id));
      navigate(`/policies/${result.policy.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Policy creation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell breadcrumb="Policies / New policy">
      <div className="mx-auto max-w-4xl">
        <p className="type-label-sm text-accent">Policy workspace · new record</p>
        <h1 className="type-page-title mt-2 text-ink">Create a policy</h1>
        <p className="type-body-lg mt-2 max-w-[72ch] text-text-secondary">
          Add the policy text to extract editable clauses for your first draft.
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
              <input id="policy-title" name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={200} autoComplete="off" className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink shadow-xs" placeholder="e.g. Visitor access policy" />
            </div>
            <div>
              <label htmlFor="policy-description" className="type-label-sm text-text-muted">Description <span className="normal-case tracking-normal">· optional</span></label>
              <input id="policy-description" name="description" value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} className="type-body-md mt-2 h-11 w-full rounded-inner border border-border-default bg-surface-white px-3 text-ink shadow-xs" placeholder="Brief context for staff reviewing this policy" />
            </div>
            <div>
              <label htmlFor="policy-text" className="type-label-sm text-text-muted">Policy text</label>
              <textarea id="policy-text" name="text" value={text} onChange={event => setText(event.target.value)} required minLength={1} rows={12} className="type-body-md mt-2 w-full rounded-inner border border-border-default bg-surface-white p-3 text-ink shadow-xs" placeholder="Paste the policy text here…" />
              <p className="type-body-sm mt-2 text-text-muted">Text is sent to the configured clause-extraction service. Review and edit the extracted clauses before publishing.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="type-label-md inline-flex h-11 items-center justify-center rounded-action border border-border-default bg-glass-80 px-6 text-ink hover:bg-surface-2">Cancel</Link>
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
