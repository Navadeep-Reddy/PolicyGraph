# AGENTS.md

## Purpose

This repository contains **CareSync**, a Hospital Policy Change Impact Tracker.

CareSync identifies operational items affected by a policy-clause change and explains every result with a verified dependency path.

This file is the operating guide for coding agents. Keep it concise. Product requirements belong in `SPEC.md`; execution order and progress belong in `BUILD_PLAN.md`; endpoints belong in `API_CONTRACT.md`.

## Read first

Before changing code:

1. Read `README.md`.
2. Read `SPEC.md`.
3. Read `API_CONTRACT.md`.
4. Read your area's tasks in `BUILD_PLAN.md`.
5. Frontend work: read `DESIGN.md`.
6. Inspect the existing implementation before creating new abstractions.

If the docs and code disagree, follow `SPEC.md` for product behavior and `API_CONTRACT.md` for request/response shapes, and update stale implementation accordingly.

## Choosing your area

Two people (and their agents) work in parallel. Every task in `BUILD_PLAN.md` is tagged `[BACKEND]`, `[FRONTEND]`, or `[INTEGRATION]`.

When the user says:

- "I'm working on the backend, what's pending?" → read only `[BACKEND]` tasks.
- "I'm working on the UI/frontend, what's pending?" → read only `[FRONTEND]` tasks.
- "Let's integrate" → read only `[INTEGRATION]` tasks.

List the unchecked tasks of that area in order, then work on the first unchecked one unless told otherwise.

## Parallel work rules

- **Backend agent** edits only `server/`. **Frontend agent** edits only `client/`.
- Only `[INTEGRATION]` work may touch both.
- `API_CONTRACT.md` is the shared boundary. Do not change an endpoint or JSON shape silently. If you must change it, edit the contract, keep the change minimal, and tell the user so the other side is notified.
- Build against the contract, not against the other side's in-progress code.
- Frontend may use a **development-only** mock layer (`VITE_USE_MOCKS=true`) shaped exactly like the contract. Mocks use generic placeholder data, are off by default, are never shown as a demo, and are removed or disabled during integration.
- Edit `BUILD_PLAN.md` only to tick or untick checkboxes of your own area. Do not reorder or reword tasks.
- Do not touch `DESIGN.md`.
- Do not reformat or refactor files you don't own.

## Progress tracking

Progress lives in `BUILD_PLAN.md` as checkboxes. Nothing else tracks it.

- Mark a task `[x]` only after it is **implemented and verified**: the relevant lint/test/build commands passed and, where the task describes behavior, you ran it.
- If a task is partly done, leave it unchecked.
- Never mark another area's tasks, and never mark a task you didn't verify.
- To report progress, count `[x]` versus total for each tag.

## Non-negotiable product rules

- PostgreSQL is the source of truth.
- Dependency edges point from upstream source to downstream consumer.
- Only `APPROVED` dependency edges participate in impact analysis.
- Impact traversal uses BFS and must prevent cycles.
- Every impact result must contain at least one complete path and a reason.
- Impact calculation happens on the backend, never in the frontend.
- Human review determines whether an item is truly affected.
- Clause dependencies reference the clause's **stable key within the policy**, never a clause row id.
- AI is used for **exactly two tasks**: clause extraction and dependency suggestion. AI-suggested dependencies are saved as `PROPOSED`. Only human action makes one `APPROVED`.
- Change detection, traversal, reasons, and persistence are deterministic. No AI.
- There is no AI fallback and no hardcoded AI response.
- The app starts empty. Never add seed data, hardcoded policies, hardcoded dependencies, or hardcoded impact results.
- The model, base URL, and API key come only from `.env`.
- Supported relationship types: `GOVERNS`, `UPDATES`, `APPEARS_IN`.
- Supported item types: `FORM`, `PROCEDURE`, `CHECKLIST`, `TRAINING_MATERIAL`, `DEPARTMENT_INSTRUCTION`, `INFORMATION_SHEET`.
- UI says "operational item"; code and database say `Artifact`.
- CareSync handles hospital operations and policy only. No patient data.

Do not introduce:

- Docker or a local database
- authentication
- Neo4j, Redis, queues, microservices, vector databases
- AI-based change detection or traversal
- OCR or PDF/DOCX extraction
- report export, notifications, approval workflows

unless the user explicitly changes the scope.

## Repository layout

Expected shape:

```text
/
├── AGENTS.md
├── README.md
├── SPEC.md
├── BUILD_PLAN.md
├── API_CONTRACT.md
├── DESIGN.md
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
- Hosted Supabase PostgreSQL
- `openai` package pointed at the NVIDIA endpoint

## Backend guidance

Keep modules coarse:

```text
src/
├── policies/
├── ai/
├── items/
├── dependencies/
├── impact/
└── prisma/
```

Responsibilities:

- `policies`: policies, versions, clauses, draft editing, publish, change detection
- `ai`: NVIDIA client, extraction and suggestion prompts, output validation
- `items`: operational items (`Artifact`)
- `dependencies`: dependency edges, graph DTOs
- `impact`: BFS, impact-run persistence, result review status
- `prisma`: database access

Keep BFS and change-detection logic independent from controllers and HTTP.

Prefer small pure functions for:
- clause change classification
- edge-validity checks
- BFS traversal
- reason generation from a path

AI output is untrusted. Parse it, validate its shape, discard invalid entries, and never let it write `APPROVED` data.

Database setup uses the Supabase CLI against a **hosted** project. No Docker.

## Frontend guidance

Follow `DESIGN.md` for every visual decision. It is canonical.

```text
src/
├── api/
├── components/
├── pages/
├── types/
└── App.tsx
```

Required pages are listed in `SPEC.md` section 4.

Rules:

- Use the existing component set before adding new ones.
- Every graph has a text equivalent.
- Show loading, error, and empty states on every data screen.
- Do not add a state-management library unless local state becomes genuinely difficult.
- Types in `src/types/` mirror `API_CONTRACT.md`.

## API rules

- Controllers should be thin.
- Validate request DTOs.
- Return the shapes in `API_CONTRACT.md`, including its error format.
- Do not expose Prisma models blindly.
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

Keep the schema limited to:

- `Policy`
- `PolicyVersion`
- `Clause`
- `Artifact`
- `DependencyEdge`
- `ImpactRun`
- `ImpactResult`

Do not add tables for features outside `SPEC.md`. Migrations are created with Prisma. There is no seed script.

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
- `PROPOSED` and `REJECTED` edges ignored
- disconnected node
- duplicate paths do not duplicate an item result

For change detection, test `ADDED`, `REMOVED`, `MODIFIED`, `UNCHANGED`.

## Work discipline

When implementing a requested task:

1. Identify the relevant unchecked task in `BUILD_PLAN.md` for your area.
2. Make the smallest coherent change that completes it.
3. Do not implement unrelated features.
4. Run relevant validation.
5. Fix failures caused by your changes.
6. Tick the checkbox only if verified.
7. Summarize changed files and validation performed.

Do not rewrite working code simply to match personal preferences.

## Definition of success

CareSync is successful when, starting from an empty database, a user can:

1. paste a policy and get editable AI-extracted clauses,
2. publish the version,
3. add operational items,
4. review AI-suggested dependencies and add one manually,
5. create a revision and change a clause,
6. see the clause marked `MODIFIED`,
7. run impact analysis,
8. see direct and indirect affected items,
9. inspect a full dependency path for every result,
10. update result review status,
11. refresh and see persisted results.
