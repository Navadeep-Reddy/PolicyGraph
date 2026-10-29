# CareSync — Specification

This is the source of truth for product behavior. It replaces the earlier generic PolicyGraph MVP spec.

## 1. Goal

A hospital staff member changes a policy clause and runs impact analysis to discover operational items (procedures, checklists, forms, and so on) that may need review.

Every result must explain **why it appeared** by showing the dependency path from the changed clause.

## 2. AI usage

AI is used only for clause extraction, dependency suggestion, and narrowly scoped transcription of OCR-needed PDF pages. NVIDIA Nemotron (OpenAI-compatible API) handles the first two; a local OpenAI-compatible Qwen vision server, preferably Ollama, handles page transcription through the existing `openai` package. Configure only through `.env`: `QWEN_OCR_API_KEY`, `QWEN_OCR_BASE_URL`, and `QWEN_OCR_MODEL` (for example, `local`, `http://localhost:11434/v1`, and `qwen3-vl:8b`). The model must be vision-capable, and its name/tag must match a model installed locally. No real DashScope key is required.

1. **Clause extraction.** Policy text → structured clauses.
2. **Dependency suggestion.** Clauses + operational items → proposed dependencies.
3. **PDF page transcription.** Rendered OCR-candidate pages → literal transcription only; no summary or interpretation.

AI output is a suggestion. Humans review and edit it. Everything else is deterministic: change detection, traversal, and persistence. There is no AI fallback. If the AI call fails, the API returns an error and the UI shows it with a retry.

### Clause extraction

Input: policy text, plus the existing clause keys when a revision is pasted as new text.

Output per clause:

```json
{ "stableKey": "VISITOR-HOURS-01", "title": "General visiting hours", "text": "Visitors are permitted until 6:00 PM.", "category": "visitor_access" }
```

When existing keys are supplied, the AI must reuse a key if the new text matches an existing clause. Only genuinely new clauses get new keys.

### Dependency suggestion

Input: the version's clauses and all operational items.

Output per suggestion: source clause key (or item id), target item id, relationship type, short rationale. Suggestions are saved as `PROPOSED`. Suggestions referencing unknown keys or ids, self-links, or duplicates of existing dependencies are discarded.

## 3. Required user flow

```text
Create policy (paste text)
→ AI extracts clauses into a draft
→ review/edit clauses
→ Publish version (draft becomes ACTIVE)
→ add operational items
→ suggest dependencies → approve / edit / reject (or add manually)
→ Create revision (copies active clauses into a draft)
→ edit draft (or paste new text)
→ Compare versions → clause changes
→ Run impact analysis → BFS over APPROVED dependencies
→ impact report: result list + graph + paths
→ update result review status
```

### Versions

- A policy has at most one `ACTIVE` version and at most one `DRAFT`.
- A new policy starts with a draft (version 1). It becomes active on **Publish**.
- **Create revision** copies the active version's clauses (same stable keys) into a new draft. It is rejected if a draft already exists.
- **Publish** makes the draft `ACTIVE` and the previous active version `ARCHIVED`. Archived versions stay viewable and comparable.
- Only drafts are editable.

## 4. Required screens

Follow `DESIGN.md` for all visual decisions. Every graph needs a text equivalent. The graph is never the only representation of a dependency or impact.

| Route | Screen |
|---|---|
| `/` | Dashboard |
| `/policies/new` | New policy |
| `/policies/:policyId` | Policy detail |
| `/items` | Operational items |
| `/policies/:policyId/dependencies` | Dependency review |
| `/policies/:policyId/compare` | Version comparison |
| `/impact-runs/:impactRunId` | Impact report |

### `/` Dashboard

- policy list: title, active version number, draft indicator, approved dependency count, latest impact run link
- **New policy** action, **Open policy** action
- empty state when no policies exist

### `/policies/new`

- title, optional description, policy text textarea
- **Extract clauses** (loading and error states for the AI call)
- on success, go to the new policy's draft

### `/policies/:policyId`

- version list (ACTIVE / DRAFT / ARCHIVED)
- clauses of the selected version
- on a draft: edit, add, delete clauses; AI-extracted clauses show the AI-proposed marker from `DESIGN.md`
- **Publish version** (draft), **Create revision** (when no draft; optional pasted text)
- links to **Dependencies** and **Compare**

### `/items`

- list, create, edit, delete operational items
- fields: name, type, department, description, optional content text

### `/policies/:policyId/dependencies`

- dependency list with status (`PROPOSED` / `APPROVED` / `REJECTED`) and origin (`AI` / `MANUAL`)
- **Suggest dependencies**
- on each proposed dependency: **Approve**, **Edit**, **Reject**
- **Add dependency** (manual, saved as `APPROVED`) and **Remove**
- dependency graph: solid edges for approved, dashed edges for proposed

### `/policies/:policyId/compare`

- choose two versions (defaults to draft vs active)
- clause-level side-by-side diff with change badges: `ADDED` / `REMOVED` / `MODIFIED` / `UNCHANGED`
- **Run impact analysis** (when comparing a draft against its predecessor)

### `/impact-runs/:impactRunId`

Show both a textual result list and a dependency graph.

Header: policy name, changed clauses with old and new wording, affected departments.

Each result contains: item name, item type, department, distance, reason, full dependency path, review status, **Confirm**, **Dismiss**, **Resolve**.

Selecting a result highlights its graph path.

## 5. Data model

Keep the schema to these tables only.

### Policy

```text
id, title, description?, createdAt, updatedAt
```

### PolicyVersion

```text
id, policyId, versionNumber
status        // DRAFT | ACTIVE | ARCHIVED
publishedAt?, createdAt
```

### Clause

```text
id, policyVersionId
stableKey     // unique within a version
title, text, category, position, textHash
```

### Artifact (UI term: "operational item")

```text
id, name
type          // FORM | PROCEDURE | CHECKLIST | TRAINING_MATERIAL | DEPARTMENT_INSTRUCTION | INFORMATION_SHEET
department, description?, content?
```

### DependencyEdge

```text
id, policyId
sourceType         // CLAUSE | ARTIFACT
sourceClauseKey?   // stable key, set when sourceType = CLAUSE
sourceArtifactId?  // set when sourceType = ARTIFACT
targetArtifactId
relationshipType   // GOVERNS | UPDATES | APPEARS_IN
status             // PROPOSED | APPROVED | REJECTED
origin             // AI | MANUAL
rationale?
```

Clause sources reference the **stable key within the policy**, not a clause row. This keeps confirmed dependencies intact across revisions. Deleting an artifact deletes its edges.

### ImpactRun

```text
id, policyVersionId, baseVersionId, createdAt
```

### ImpactResult

```text
id, impactRunId, changedClauseKey, artifactId
distance, pathJson, reason
reviewStatus     // PROPOSED | CONFIRMED | DISMISSED | RESOLVED
reviewComment?
```

`pathJson` stores ordered nodes and edges directly. Do not normalize path storage.

## 6. Clause change detection

Compare two versions by `stableKey`. The default base is the previous version number.

```text
key only in target          → ADDED
key only in base            → REMOVED
same key, different hash    → MODIFIED
same key, same hash         → UNCHANGED
```

No embeddings, semantic matching, or AI.

## 7. Impact traversal

Runs on the backend, in a pure function independent of HTTP.

### Start nodes

Every `MODIFIED` or `REMOVED` clause (by stable key) between the draft and its base version.

### Eligible edges

Only `status = APPROVED` edges of the same policy.

### BFS

```text
for each changed clause:
    queue = [(clauseNode, [clauseNode])]
    visited = {clauseNode}

    while queue not empty:
        current, path = queue.pop_front()

        for edge in approvedOutgoingEdges(current):
            next = edge.target
            if next in visited: continue
            visited.add(next)
            nextPath = path + edge + next
            save impact result (changedClauseKey, next, nextPath)
            queue.push_back(next, nextPath)
```

Requirements:

- outgoing traversal only
- no infinite loops
- shortest unweighted path per item
- one result per item per changed clause
- `reason` is generated from the path by a template, not by AI
- order results by distance, then item name
- if no clause changed, return an empty run (no error)

## 8. API

See `API_CONTRACT.md`. It is the single source of truth for endpoints and JSON shapes.

## 9. Frontend components

Keep the set small:

```text
PolicyCard
ClauseEditor
ItemForm
DependencyRow
DependencyGraph
VersionDiff
ChangeBadge
ImpactList
ImpactResultCard
PathViewer
StatusBadge
```

Graph behavior: show clause and item names, label relationship edges, fit to viewport, solid edges for approved and dashed for proposed, selecting an impact highlights its path, and the path is also readable as text.

## 10. Required error states

Handle:

- policy, version, or item missing
- API request failed
- AI call failed (retry available)
- AI returned unusable output
- draft already exists / nothing to publish
- no base version to compare against
- no changed clauses
- changed clause has no approved downstream dependencies
- cyclic graph
- empty lists (policies, items, dependencies)

## 11. Out of scope

- patient records, clinical content
- authentication and roles
- DOCX extraction
- hospital-system integration
- notifications, email
- approval workflows
- report export
- AI fallback
- seeded or hardcoded demo data
- graph or vector databases

## 12. Acceptance checklist

- [ ] app starts with an empty database
- [ ] policy text is turned into editable clauses by AI
- [ ] draft can be published; previous active version is archived
- [ ] operational items can be created, edited, deleted
- [ ] AI-suggested dependencies are saved as `PROPOSED`
- [ ] dependencies can be approved, edited, rejected, added manually, removed
- [ ] revision copies active clauses with the same stable keys
- [ ] approved dependencies survive revision and publish
- [ ] comparison shows `ADDED` / `REMOVED` / `MODIFIED` / `UNCHANGED`
- [ ] BFS finds direct items
- [ ] BFS finds indirect items
- [ ] cycles cannot loop traversal
- [ ] `PROPOSED` and `REJECTED` edges are ignored
- [ ] every impact has a full path and reason
- [ ] impact run persists in PostgreSQL
- [ ] review status can be updated and survives refresh
- [ ] every graph has a text equivalent
- [ ] UI follows `DESIGN.md`
- [ ] complete flow requires no manual database editing
