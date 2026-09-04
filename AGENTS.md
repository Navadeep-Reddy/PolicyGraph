# AGENTS.md

## Purpose

This repository contains the **PolicyGraph one-day MVP**.

PolicyGraph identifies operational artifacts affected by a policy-clause change and explains every result using a verified dependency path.

This file is the operating guide for coding agents. Keep it concise. Product requirements belong in `MVP_SPEC.md`; execution order belongs in `BUILD_PLAN.md`.

## Read first

Before changing code:

1. Read `README.md`.
2. Read `MVP_SPEC.md`.
3. Read the current phase in `BUILD_PLAN.md`.
4. Inspect the existing implementation before creating new abstractions.

If the docs and code disagree, follow `MVP_SPEC.md` for product behavior and update stale implementation accordingly.

## Today's target

The required vertical slice is:

```text
Travel reimbursement policy
→ deadline changes 30 days to 15 days
→ clause classified MODIFIED
→ run BFS impact analysis
→ show affected Form / Procedure / Software Rule
→ show exact dependency path
→ review status can be updated and persists
```

Do not broaden the task until this works end to end.

## Non-negotiable product rules

- PostgreSQL is the source of truth.
- Dependency edges point from upstream source to downstream consumer.
- Only `APPROVED` dependency edges participate in official impact analysis.
- Impact traversal uses BFS.
- BFS must prevent cycles.
- Every impact result must contain at least one complete path.
- Impact calculation happens on the backend, never in the frontend.
- Human review determines whether an artifact is truly affected.
- Supported artifact types for the MVP are:
  - `FORM`
  - `PROCEDURE`
  - `SOFTWARE_RULE`
- AI is optional and is not required for today's MVP.

Do not introduce:
- Neo4j
- Redis
- queues
- microservices
- vector databases
- automatic dependency discovery
- LLM-based change detection
- PDF/DOCX extraction

unless the user explicitly changes the scope.

## Repository layout

Expected shape:

```text
/
├── AGENTS.md
├── README.md
├── MVP_SPEC.md
├── BUILD_PLAN.md
├── client/
└── server/
```

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- `@xyflow/react`

Backend:
- NestJS
- TypeScript
- Prisma
- PostgreSQL

## Backend guidance

Keep modules coarse:

```text
src/
├── policies/
├── graph/
├── impact/
└── prisma/
```

Responsibilities:

- `policies`: policies, versions, clauses, draft editing, change detection
- `graph`: artifacts, dependency edges, graph DTOs
- `impact`: BFS, impact-run persistence, result review status
- `prisma`: database access

Keep BFS/domain logic independent from controllers and HTTP concerns.

Prefer small pure functions for:
- clause change classification
- edge-validity checks
- BFS traversal

## Frontend guidance

Keep the first implementation simple:

```text
src/
├── api/
├── components/
├── pages/
├── types/
└── App.tsx
```

Required pages:

- dashboard
- policy/version comparison
- impact report + dependency graph

Do not add a state-management library unless local/component state becomes genuinely difficult.

Do not build a design system before the core demo works.

## API rules

- Controllers should be thin.
- Validate request DTOs.
- Return frontend-friendly DTOs.
- Do not expose Prisma models blindly if the UI needs a different shape.
- Persist completed impact runs and results.
- Never return hardcoded impact results from controllers.

## Coding style

- TypeScript strict mode.
- Prefer explicit domain names over abbreviations.
- Keep functions focused.
- Avoid speculative abstractions.
- Avoid `any` unless unavoidable at an external boundary.
- Do not silently swallow errors.
- Comments should explain *why*, not restate code.
- Preserve existing formatting/lint conventions once established.

## Database rules

Keep the one-day schema limited to:

- `Policy`
- `PolicyVersion`
- `Clause`
- `Artifact`
- `DependencyEdge`
- `ImpactRun`
- `ImpactResult`

Do not add tables for deferred features merely because they exist in the full project specification.

Seed the canonical demo from `MVP_SPEC.md`.

## Required validation

After meaningful backend changes, run the available equivalent of:

```bash
npm run lint
npm test
npm run build
```

After meaningful frontend changes, run the available equivalent of:

```bash
npm run lint
npm run build
```

If a command does not yet exist, do not invent a passing result. Use the closest available check and report what was actually run.

For BFS changes, test at minimum:

- direct dependency
- indirect dependency
- cycle prevention
- unapproved edge ignored
- disconnected node
- duplicate paths do not duplicate an artifact result

## Work discipline

When implementing a requested task:

1. Identify the relevant unchecked phase in `BUILD_PLAN.md`.
2. Make the smallest coherent change that advances that phase.
3. Do not implement unrelated stretch features.
4. Run relevant validation.
5. Fix failures caused by your changes.
6. Summarize changed files and validation performed.

Do not rewrite working code simply to match personal preferences.

## Definition of success

The MVP is successful when a user can:

1. open the seeded Travel Reimbursement Policy,
2. see/edit the deadline change from 30 to 15 days,
3. see the clause marked `MODIFIED`,
4. run impact analysis,
5. see direct and indirect affected artifacts,
6. inspect a full dependency path for every result,
7. update result review status,
8. refresh and see persisted results.
