# CareSync — Build Plan

Build **vertically** and keep Backend and Frontend independent until Integration.

```text
scaffold
→ policies + AI clauses
→ items
→ dependencies + AI suggestions
→ compare
→ BFS impact
→ report + review status
→ integrate
```

`AGENTS.md` contains coding-agent rules. `API_CONTRACT.md` is the shared boundary. This file defines implementation order **and tracks progress**.

## How to use this file

- Every task has an ID and a tag: `B-xx` `[BACKEND]`, `F-xx` `[FRONTEND]`, `I-xx` `[INTEGRATION]`.
- Work only on your area's tasks, top to bottom.
- Tick `[x]` only after the task is implemented **and verified**.
- Backend and Frontend tasks do not wait on each other. Frontend builds against `API_CONTRACT.md`.
- Integration tasks start once the Backend and Frontend tasks they list are checked.

---

## Backend

### Setup

- [x] B-01 `[BACKEND]` Create NestJS project in `server/` with strict TypeScript, lint, test, and build scripts
- [x] B-02 `[BACKEND]` Create a hosted Supabase project with the Supabase CLI; add `DATABASE_URL` and `DIRECT_URL` to `server/.env` and `.env.example` (no Docker)
- [x] B-03 `[BACKEND]` Configure Prisma and create the schema from `SPEC.md` section 5 with the initial migration; add `db:migrate` and `db:reset` scripts; no seed
- [x] B-04 `[BACKEND]` Enable CORS, add `GET /health`, global validation, and the contract error format

### Policies and AI clauses

- [x] B-05 `[BACKEND]` `GET /policies`, `GET /policies/:id`, `GET /versions/:versionId`
- [x] B-06 `[BACKEND]` NVIDIA client in `ai/` using the `openai` package; base URL, model, and key from `.env` only
- [x] B-07 `[BACKEND]` Clause extraction: prompt, JSON parsing, shape validation, reuse of supplied existing keys
- [x] B-08 `[BACKEND]` `POST /policies` (creates policy, draft v1, AI-extracted clauses; `AI_FAILED` on failure)
- [x] B-09 `[BACKEND]` `POST /policies/:id/revisions` (copy active clauses with the same keys; optional pasted text re-extracts with key reuse)
- [x] B-10 `[BACKEND]` Draft clause `POST` / `PATCH` / `DELETE` (draft only; recompute `textHash`)
- [x] B-11 `[BACKEND]` `POST /versions/:versionId/publish` (draft → ACTIVE, previous ACTIVE → ARCHIVED)

### Change detection

- [ ] B-12 `[BACKEND]` Pure clause change classification with tests for `ADDED`, `REMOVED`, `MODIFIED`, `UNCHANGED`
- [ ] B-13 `[BACKEND]` `GET /versions/:versionId/changes` (optional `against`)

### Operational items

- [ ] B-14 `[BACKEND]` Items `GET` / `POST` / `PATCH` / `DELETE` (deleting removes its edges)

### Dependencies

- [ ] B-15 `[BACKEND]` Dependency `GET` / `POST` (manual, saved `APPROVED`) / `PATCH` / `DELETE`, with validation (known key or id, no self-link, no duplicate)
- [ ] B-16 `[BACKEND]` `POST /policies/:id/dependency-suggestions`: AI suggestions saved `PROPOSED`, invalid or duplicate ones discarded
- [ ] B-17 `[BACKEND]` `GET /policies/:id/graph` (nodes and edges with status)

### Impact

- [ ] B-18 `[BACKEND]` BFS as a pure function with tests: direct, indirect, cycle, `PROPOSED`/`REJECTED` ignored, disconnected, duplicate paths
- [ ] B-19 `[BACKEND]` Reason generation from a path (template, no AI)
- [ ] B-20 `[BACKEND]` `POST /versions/:versionId/impact-runs`, `GET /impact-runs/:id`, `GET /versions/:versionId/impact-runs`; persist run, path, distance, reason
- [ ] B-21 `[BACKEND]` `PATCH /impact-results/:id` (review status and comment)

### Finish

- [ ] B-22 `[BACKEND]` `npm run lint`, `npm test`, `npm run build` all pass

**Backend exit:** every endpoint in `API_CONTRACT.md` responds with the documented shape against an empty database.

---

## Frontend

### Setup

- [ ] F-01 `[FRONTEND]` Create React + TypeScript + Vite project in `client/`, configure Tailwind, add `@xyflow/react`, apply `DESIGN.md` tokens
- [ ] F-02 `[FRONTEND]` App shell with router and navigation for all routes in `SPEC.md` section 4
- [ ] F-03 `[FRONTEND]` Typed API client and types mirroring `API_CONTRACT.md`; dev-only mock layer behind `VITE_USE_MOCKS`
- [ ] F-04 `[FRONTEND]` Shared components: `StatusBadge`, `ChangeBadge`, loading, error, and empty states

### Screens

- [ ] F-05 `[FRONTEND]` Dashboard `/`
- [ ] F-06 `[FRONTEND]` New policy `/policies/new` with AI loading and error states
- [ ] F-07 `[FRONTEND]` Policy detail `/policies/:policyId`: versions, clauses, draft edit/add/delete, AI-proposed marker, Publish, Create revision
- [ ] F-08 `[FRONTEND]` Operational items `/items`: list, create, edit, delete
- [ ] F-09 `[FRONTEND]` `DependencyGraph` component: solid approved edges, dashed proposed edges, relationship labels, fit view, text equivalent
- [ ] F-10 `[FRONTEND]` Dependency review `/policies/:policyId/dependencies`: Suggest, Approve, Edit, Reject, manual Add, Remove
- [ ] F-11 `[FRONTEND]` Comparison `/policies/:policyId/compare`: version pickers, side-by-side diff, change badges, Run impact analysis
- [ ] F-12 `[FRONTEND]` Impact report `/impact-runs/:impactRunId`: header, result list, `PathViewer`, graph, selected-path highlight
- [ ] F-13 `[FRONTEND]` Review actions: Confirm, Dismiss, Resolve with status badge

### Finish

- [ ] F-14 `[FRONTEND]` Loading, error, and empty states verified on every screen; responsive layout checked
- [ ] F-15 `[FRONTEND]` `npm run lint` and `npm run build` pass

**Frontend exit:** every screen works against the mock layer and matches `DESIGN.md`.

---

## Integration

Start each task only when the listed tasks are checked.

- [ ] I-01 `[INTEGRATION]` (needs B-04, F-03) Client reads `/health` from the real API; set `VITE_API_URL`
- [ ] I-02 `[INTEGRATION]` (needs B-08, F-06) Pasted policy text produces real AI-extracted clauses in the UI
- [ ] I-03 `[INTEGRATION]` (needs B-09–B-11, F-07) Edit, publish, and revision flow works end to end
- [ ] I-04 `[INTEGRATION]` (needs B-14–B-17, F-08–F-10) Items, AI suggestions, approve/reject, manual add, and graph work end to end
- [ ] I-05 `[INTEGRATION]` (needs B-13, F-11) Comparison shows correct change badges
- [ ] I-06 `[INTEGRATION]` (needs B-18–B-21, F-12–F-13) Impact run, report, paths, and review status persist after refresh
- [ ] I-07 `[INTEGRATION]` Remove or disable the mock layer; fix contract mismatches in `API_CONTRACT.md` and both sides
- [ ] I-08 `[INTEGRATION]` Verify setup from `README.md` on a clean clone
- [ ] I-09 `[INTEGRATION]` Run the final smoke test below on an empty database

---

## Final smoke test

Start from an empty database. Enter all data yourself.

1. Create a policy by pasting visitor-policy text that says visitors are permitted until 8:00 PM.
2. Review the AI-extracted clauses and edit one if needed.
3. Publish the version.
4. Add operational items: a security desk procedure, a ward visitor checklist, a visitor information sheet, and a staff training material.
5. Click **Suggest dependencies**. Approve the correct ones, reject a wrong one, and add one missed dependency manually, including one two-hop link (procedure → training material).
6. Create a revision and change the visiting-hours clause to 6:00 PM.
7. Open **Compare** and confirm the clause is `MODIFIED`.
8. Run impact analysis.
9. Confirm direct and indirect items appear.
10. Select the indirect item and confirm the full path is shown in text and in the graph.
11. Resolve one impact.
12. Refresh and confirm the status persisted.

If that works cleanly, stop adding features and demo it.
