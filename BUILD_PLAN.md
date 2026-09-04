# PolicyGraph — Build Plan

Build **vertically**, not feature-by-feature across the entire final project.

```text
seed data
→ edit clause
→ detect change
→ BFS
→ persist impact
→ render report + graph
→ polish
```

`AGENTS.md` contains coding-agent rules. This file only defines implementation order.

---

## Phase 1 — Scaffold

### Client

- [ ] create React + TypeScript + Vite project
- [ ] configure Tailwind
- [ ] add `@xyflow/react`

### Server

- [ ] create NestJS project
- [ ] configure Prisma
- [ ] connect PostgreSQL
- [ ] enable local CORS
- [ ] add `/health`

### Integration

- [ ] client can call `/health`

**Exit:** frontend successfully reads a response from the backend.

---

## Phase 2 — Schema + seed

Create only:

- [ ] `Policy`
- [ ] `PolicyVersion`
- [ ] `Clause`
- [ ] `Artifact`
- [ ] `DependencyEdge`
- [ ] `ImpactRun`
- [ ] `ImpactResult`

Then:

- [ ] create migration
- [ ] seed the canonical travel-reimbursement scenario
- [ ] verify seed can be rerun safely or reset easily

**Exit:** one seed/reset command creates the entire demo dataset.

---

## Phase 3 — Policy read/edit

Implement:

```http
GET /policies
GET /policies/:id
GET /policies/:id/versions
PATCH /versions/:versionId/clauses/:clauseId
```

Then build:

- [ ] dashboard
- [ ] policy page
- [ ] active clause display
- [ ] draft textarea
- [ ] save draft

**Exit:** user can change the draft clause in the browser and refresh without losing it.

---

## Phase 4 — Change detection

Implement stable-key comparison:

```text
ADDED
REMOVED
MODIFIED
UNCHANGED
```

Add:

```http
GET /versions/:versionId/changes
```

Frontend:

- [ ] show change badge
- [ ] show simple active-vs-draft comparison

**Exit:** default 30-day → 15-day draft is shown as `MODIFIED`.

---

## Phase 5 — Dependency graph

Backend:

```http
GET /policies/:id/graph
```

Frontend:

- [ ] React Flow nodes
- [ ] relationship labels
- [ ] sensible layout
- [ ] fit view

Required seed graph:

```text
Clause → Travel Claim Form
Clause → Finance Reimbursement Procedure
Travel Claim Form → Backend Deadline Validation Rule
```

**Exit:** the seeded graph is readable in the browser.

---

## Phase 6 — BFS impact engine

Implement BFS as backend domain logic.

Required tests:

- [ ] direct dependency
- [ ] two-hop dependency
- [ ] cycle prevention
- [ ] disconnected node
- [ ] unapproved edge ignored
- [ ] duplicate reachable paths do not duplicate artifact result

Then add:

```http
POST /versions/:versionId/impact-runs
GET /impact-runs/:impactRunId
```

Persist:

- run
- artifact
- distance
- path
- reason
- review status

**Exit:** default run returns exactly the three expected artifacts, including the two-hop software rule.

---

## Phase 7 — Impact report

Build `/impact-runs/:impactRunId`.

Add:

- [ ] textual result list
- [ ] graph
- [ ] distance
- [ ] reason
- [ ] textual path
- [ ] selected-path graph highlight

**Exit:** selecting `Backend Deadline Validation Rule` clearly shows:

```text
TRAVEL-CLAIM-DEADLINE
→ Travel Claim Form
→ Backend Deadline Validation Rule
```

---

## Phase 8 — Review status

Implement:

```http
PATCH /impact-results/:impactResultId
```

Support:

```text
PROPOSED
CONFIRMED
DISMISSED
RESOLVED
```

Frontend:

- [ ] status badge
- [ ] Confirm
- [ ] Dismiss
- [ ] Resolve

**Exit:** status changes persist after refresh.

---

## Phase 9 — Demo polish

Only polish visible MVP paths.

- [ ] loading states
- [ ] request error state
- [ ] no-impact state
- [ ] readable graph nodes
- [ ] consistent badges/buttons
- [ ] responsive impact layout
- [ ] useful empty copy
- [ ] seed/reset instructions

Do not refactor working features for elegance unless necessary.

---

## Stretch order

Only after every MVP acceptance item passes:

1. [ ] simple deadline conflict: 30 vs 15 days
2. [ ] lightweight audit events
3. [ ] Supabase Auth
4. [ ] policy/version creation UI
5. [ ] lifecycle states
6. [ ] priority score
7. [ ] AI structured-rule suggestion

---

## Final smoke test

Perform this from the browser:

1. Open **Travel Reimbursement Policy**.
2. Show the active 30-day clause.
3. Change/save the draft as 15 days.
4. Confirm `MODIFIED`.
5. Run impact analysis.
6. Confirm all three impacts.
7. Select Backend Deadline Validation Rule.
8. Show the two-hop path.
9. Resolve one impact.
10. Refresh.
11. Confirm persisted result/status.

If that works cleanly, stop adding features and demo it.
